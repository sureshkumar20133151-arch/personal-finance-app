import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth/mammoth.browser';

// Configure PDF worker
// Use Vite's ?url import to get the path to the worker in node_modules
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch (e) {
    console.warn("Could not set PDF worker source", e);
}

export const parseStatement = async (file, password = null) => {
    const fileName = file.name.toLowerCase();
    const fileType = file.type;

    if (fileType.includes('csv') || fileName.endsWith('.csv')) {
        return await parseCSV(file);
    } else if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
        return await parsePDF(file, password);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileType.includes('spreadsheet') || fileType.includes('excel')) {
        return await parseXLSX(file);
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc') || fileType.includes('word') || fileType.includes('document')) {
        return await parseDOCX(file);
    } else if (fileName.endsWith('.txt') || fileType.includes('text/plain')) {
        return await parseTXT(file);
    } else {
        throw new Error('Unsupported file type. Please upload CSV, PDF, XLSX, DOCX, or TXT.');
    }
};

const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: false, // We'll parse as array of arrays first to find the header row
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const rows = results.data;
                    if (!rows || rows.length === 0) {
                        resolve([]);
                        return;
                    }

                    // Find header row index
                    const headerRowIndex = findHeaderRowIndex(rows);

                    if (headerRowIndex === -1) {
                        // Fallback: Try to parse without headers if it looks like data?
                        // For now, if we can't find clear headers, we might fail or try column heuristics
                        resolve([]);
                        return;
                    }

                    const headers = rows[headerRowIndex].map(h => String(h).toLowerCase().trim());
                    const dataRows = rows.slice(headerRowIndex + 1);

                    const objData = dataRows.map(row => {
                        const obj = {};
                        headers.forEach((h, i) => {
                            if (row[i] !== undefined) {
                                obj[h] = row[i];
                            }
                        });
                        return obj;
                    });

                    const transactions = normalizeTransactions(objData);
                    resolve(transactions);
                } catch (err) {
                    reject(err);
                }
            },
            error: (err) => {
                reject(err);
            }
        });
    });
};

const parsePDF = async (file, password = null) => {
    const arrayBuffer = await file.arrayBuffer();
    
    // Pass the password to PDF.js. If it's wrong or missing and the PDF is encrypted, it throws PasswordException.
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, password }).promise;
    let fullText = [];

    // Crude extraction: get all text items with their Y coordinates
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Group by Y coordinate (row) with some tolerance
        const rows = groupTextItemsByRow(textContent.items);
        fullText = [...fullText, ...rows];
    }

    return normalizePDFRows(fullText);
};

// Helper: Group PDF text items into lines based on Y position
const groupTextItemsByRow = (items) => {
    const rows = [];
    const tolerance = 5; // pixels

    // Sort by Y (descending for PDF) then X (ascending)
    items.sort((a, b) => {
        if (Math.abs(a.transform[5] - b.transform[5]) > tolerance) {
            return b.transform[5] - a.transform[5]; // Top to bottom
        }
        return a.transform[4] - b.transform[4]; // Left to right
    });

    let currentRow = [];
    let currentY = items[0]?.transform[5];

    items.forEach(item => {
        if (!item.str.trim()) return;

        if (Math.abs(item.transform[5] - currentY) > tolerance) {
            // New row
            if (currentRow.length > 0) rows.push(currentRow.join(' '));
            currentRow = [];
            currentY = item.transform[5];
        }
        currentRow.push(item.str);
    });

    if (currentRow.length > 0) rows.push(currentRow.join(' '));
    return rows;
};

// Heuristic Normalizer for CSV Data
const normalizeTransactions = (rawData) => {
    // We need to map various CSV headers to our schema:
    // date, description, amount, type ('income' or 'expense')

    return rawData.map(row => {
        // 1. Normalize Keys (lowercase, remove spaces)
        const normalizedRow = {};
        Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase().trim()] = row[key];
        });

        // 2. Detect Fields
        const date = findValue(normalizedRow, ['date', 'txn date', 'transaction date', 'posting date', 'value date', 'reference date']);
        const description = findValue(normalizedRow, ['description', 'desc', 'particulars', 'narration', 'details', 'transaction details', 'memo', 'remarks']);
        let credit = findValue(normalizedRow, ['credit', 'cr', 'deposit', 'amount credit', 'paid in', 'plus']);
        let debit = findValue(normalizedRow, ['debit', 'dr', 'withdrawal', 'amount debit', 'paid out', 'less']);
        let amount = findValue(normalizedRow, ['amount', 'txn amount', 'transaction amount', 'local amount']);
        const typeField = findValue(normalizedRow, ['type', 'txn type', 'cr/dr', 'direction']);

        if (!date) return null; // Skip invalid rows

        // 3. Determine Amount and Type
        let finalAmount = 0;
        let finalType = 'expense';

        if (credit && parseFloat(credit) > 0) {
            finalAmount = parseFloat(credit);
            finalType = 'income';
        } else if (debit && parseFloat(debit) > 0) {
            finalAmount = parseFloat(debit);
            finalType = 'expense';
        } else if (amount) {
            // Some CSVs use +/- for direction, or have a separate 'CR/DR' column
            let parsedAmt = parseFloat(String(amount).replace(/,/g, ''));

            if (typeField) {
                if (typeField.toLowerCase().includes('cr') || typeField.toLowerCase().includes('credit')) {
                    finalType = 'income';
                    finalAmount = Math.abs(parsedAmt);
                } else {
                    finalType = 'expense';
                    finalAmount = Math.abs(parsedAmt);
                }
            } else {
                // Infer from sign
                if (parsedAmt > 0) {
                    finalType = 'income';
                    // HEURISTIC: In many CSVs (revolut, monzo, etc), positive is income, negative is expense.
                    // BUT in some credit card statements, positive is expense (money owed).
                    // We'll stick to: Positive = Income, Negative = Expense. User can edit.
                    finalAmount = parsedAmt;
                } else {
                    finalType = 'expense';
                    finalAmount = Math.abs(parsedAmt);
                }
            }
        }

        // Fallback for CSV: If Date is missing but we have columns, maybe try index 0?
        let usedDate = date;
        if (!usedDate) {
            // Heuristic: First value that looks like a date?
            // Heuristic: First value that looks like a date?
            // Not safe to assume.
            // If we found NO date, skip.
            return null;
        }

        if (!finalAmount && finalAmount !== 0) return null;

        // 4. Format Date
        // Handle dot separators
        usedDate = usedDate.replace(/\./g, '-');
        // We'll rely on the Date constructor for now, but might need date-fns parsing for specific formats
        let dateObj = new Date(usedDate);
        if (isNaN(dateObj.getTime())) {
            // Try DD/MM/YYYY manually if standard parse fails
            const parts = usedDate.split(/[\/\-\.]/);
            if (parts.length === 3) {
                // specific check for dd/mm/yyyy vs mm/dd/yyyy is hard without context, assume dd/mm/yyyy for most international users
                // or verify if first part > 12.
                if (parseInt(parts[0]) > 12) {
                    // definite dd/mm/yyyy
                    dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                    // Ambiguous. Default browser behavior or prefer local format.
                    // For now, let's assume it worked or failed.
                }
            }
        }

        const isoDate = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        return {
            date: isoDate,
            description: description || 'Imported Transaction',
            amount: finalAmount,
            type: finalType,
            categoryId: '', // User will map this or we default to empty
            originalRow: row
        };
    }).filter(t => t !== null);
};

// Heuristic Normalizer for PDF Text Lines
const normalizePDFRows = (rows) => {
    // Looking for lines that start with a date pattern
    // Regex for date: \d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4} or \d{4}-\d{2}-\d{2}
    // const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s\d{2,4})/i;
    // Regex for date: Supports DD/MM/YYYY, YYYY-MM-DD, and textual months like 12 Jan 2024
    // Regex for date: Supports DD/MM/YYYY, YYYY-MM-DD, DD.MM.YYYY, and textual months like 12 Jan 2024
    const dateRegex = /(\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b)|(\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b)|(\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4}\b)/i;

    const transactions = [];

    rows.forEach(row => {
        const dateMatch = row.match(dateRegex);
        if (dateMatch) {
            // Potential transaction row
            // Strategy: Extract date. Look for numbers at the end (amounts). Everything in between is description.

            const dateStr = dateMatch[0];
            const remaining = row.replace(dateStr, '').trim();

            // Find amounts. Look for number with decimal or commas at the end of string
            // Regex to find the LAST number in the string which is likely the transaction amount or balance
            // Often bank statements have: Date | Desc | Withdrawal | Deposit | Balance
            // or: Date | Desc | Amount

            // We'll try to find all money-like patterns
            const moneyRegex = /([\d,]+\.\d{2})/g;
            const amounts = [...remaining.matchAll(moneyRegex)].map(m => parseFloat(m[0].replace(/,/g, '')));

            if (amounts.length > 0) {
                // If 1 amount: Assume it's the transaction amount.
                // If 2 amounts: Likely [Txn Amount, Balance].
                // If 3 amounts: Likely [Withdrawal, Deposit, Balance] or similar.

                let amount = 0;
                let type = 'expense';

                if (amounts.length >= 3) {
                    // Usually Indian bank format: Date | ... | Withdrawal | Deposit | Balance
                    const withdrawal = amounts[amounts.length - 3];
                    const deposit = amounts[amounts.length - 2];
                    if (withdrawal > 0) {
                        amount = withdrawal;
                        type = 'expense';
                    } else if (deposit > 0) {
                        amount = deposit;
                        type = 'income';
                    } else {
                        // fallback
                        amount = amounts[0];
                    }
                } else if (amounts.length === 2) {
                    // Usually: Date | ... | Txn Amount | Balance
                    amount = amounts[0];
                } else {
                    amount = amounts[0];
                }

                // Heuristic override for Income/Expense based on text
                const textLower = remaining.toLowerCase();
                if (textLower.includes('/cr/') || textLower.includes(' cr') || textLower.includes('neft cr') || textLower.includes('credit') || textLower.includes('inp') || textLower.includes('salary')) {
                    type = 'income';
                } else if (textLower.includes('/dr/') || textLower.includes(' dr') || textLower.includes('debit') || textLower.includes('atm') || textLower.includes('pos') || textLower.includes('upi/')) {
                    // Ensure it stays expense unless overriden by specific deposit field
                    if (amounts.length >= 3 && amounts[amounts.length - 2] > 0) {
                        type = 'income'; // Trust the deposit column over text
                    } else {
                        type = 'expense';
                    }
                }

                // Check for Cr/Dr keywords in description
                if (remaining.toLowerCase().includes(' cr ') || remaining.toLowerCase().endsWith(' cr')) {
                    type = 'income';
                }

                const description = remaining.replace(moneyRegex, '').trim().replace(/\s+/g, ' ');

                // Parse Date
                let dateObj = new Date(dateStr);

                // If regex matched DD/MM/YYYY or similar, we need to be careful
                // If textual (12 Jan 2024), Date() usually handles it.
                // If numeric (12/01/2024), we should assume DD/MM/YYYY for international context usually

                const isNumericDate = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(dateStr);
                if (isNumericDate) {
                    const parts = dateStr.split(/[\/\-]/);
                    // If first part > 12, definitely DD/MM/YYYY (or YYYY-MM-DD but that's handled by Date())
                    // If YYYY is first, Date() handles it.
                    if (parts[0].length === 4) {
                        // YYYY-MM-DD - standard
                        dateObj = new Date(dateStr);
                    } else if (parseInt(parts[0]) > 12) {
                        // DD-MM-YYYY
                        dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else {
                        // Ambiguous. Default to DD-MM-YYYY for consistency with most bank statements outside US
                        // Note: If user is US based, this might flip dates. 
                        // For now, we assume DD-MM-YYYY preference or try to detect.
                        // Let's force DD-MM-YYYY for now as a safer default for international 'budget tracker'
                        dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    }
                }

                const isoDate = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

                transactions.push({
                    date: isoDate,
                    description: description || 'PDF Import',
                    amount: amount,
                    type: type,
                    categoryId: '',
                    originalRow: row
                });
            }
        }
    });

    return transactions;
};

// Parse XLSX/XLS files using SheetJS
const parseXLSX = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to JSON array of arrays
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!rawData || rawData.length === 0) {
        throw new Error('Excel file appears to be empty.');
    }

    // Find header row (skipping metadata at top)
    const headerRowIndex = findHeaderRowIndex(rawData);

    if (headerRowIndex === -1) {
        throw new Error('Could not identify a header row in the Excel file. Please ensure columns like "Date", "Description", and "Amount" exist.');
    }

    const headers = rawData[headerRowIndex].map(h => String(h).toLowerCase().trim());
    const dataRows = rawData.slice(headerRowIndex + 1);

    // Convert to object format like CSV
    const objData = dataRows.map(row => {
        const obj = {};
        headers.forEach((header, idx) => {
            obj[header] = row[idx] !== undefined ? row[idx] : '';
        });
        return obj;
    }).filter(row => Object.values(row).some(v => v !== ''));

    return normalizeTransactions(objData);
};

// Parse DOCX files using Mammoth
const parseDOCX = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;

    // Split into lines and parse like TXT
    const lines = text.split('\n').filter(line => line.trim());
    return parseTextLines(lines);
};

// Parse TXT files
const parseTXT = async (file) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    return parseTextLines(lines);
};

// Common text line parser (used by DOCX and TXT)
const parseTextLines = (lines) => {
    // Regex for date: Supports DD/MM/YYYY, YYYY-MM-DD, and textual months like 12 Jan 2024
    // Regex for date: Supports DD/MM/YYYY, YYYY-MM-DD, DD.MM.YYYY, and textual months like 12 Jan 2024
    const dateRegex = /(\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b)|(\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b)|(\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4}\b)/i;
    const transactions = [];

    lines.forEach(line => {
        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
            const dateStr = dateMatch[0];
            const remaining = line.replace(dateStr, '').trim();

            // Find amounts
            const moneyRegex = /([\d,]+\.?\d*)/g;
            const amounts = [...remaining.matchAll(moneyRegex)]
                .map(m => parseFloat(m[0].replace(/,/g, '')))
                .filter(a => a > 0 && a < 10000000); // Filter out unrealistic amounts

            if (amounts.length > 0) {
                let amount = amounts[0];
                let type = 'expense';

                // Check for Cr/Dr keywords
                if (remaining.toLowerCase().includes(' cr ') ||
                    remaining.toLowerCase().endsWith(' cr') ||
                    remaining.toLowerCase().includes('credit') ||
                    remaining.toLowerCase().includes('deposit')) {
                    type = 'income';
                }

                const description = remaining.replace(moneyRegex, '').trim().replace(/\s+/g, ' ') || 'Text Import';

                // Parse Date
                const dateParts = dateStr.split(/[\/\-]/);
                let dateObj = new Date(dateStr);
                if (dateParts.length === 3 && parseInt(dateParts[0]) > 12) {
                    dateObj = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
                }

                const isoDate = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

                transactions.push({
                    date: isoDate,
                    description,
                    amount,
                    type,
                    categoryId: '',
                    originalRow: line
                });
            }
        }
    });

    return transactions;
};

// Helper
const findValue = (obj, keys) => {
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== '') return obj[key];
    }
    return null;
};

const findHeaderRowIndex = (rows) => {
    if (!rows || rows.length === 0) return -1;
    const limit = Math.min(rows.length, 50);
    const headerKeywords = [
        'date', 'description', 'amount', 'credit', 'debit', 'cr', 'dr',
        'narration', 'particulars', 'transaction', 'txn', 'deposit', 'withdrawal'
    ];

    for (let i = 0; i < limit; i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;

        let matchCount = 0;
        for (const cell of row) {
            if (cell === undefined || cell === null) continue;
            const val = String(cell).toLowerCase().trim();
            if (headerKeywords.some(keyword => val.includes(keyword))) {
                matchCount++;
            }
        }

        if (matchCount >= 2) {
            return i;
        }
    }

    // Default: find first row with data
    for (let i = 0; i < limit; i++) {
        if (rows[i] && rows[i].some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')) {
            return i;
        }
    }

    return -1;
};
