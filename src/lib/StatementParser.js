// Heavy libraries are dynamically imported inside each parse function
// to avoid loading them on app startup (saves ~1MB+ from initial bundle)


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

const parseCSV = async (file) => {
    const { default: Papa } = await import('papaparse');
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
    const pdfjsLib = await import('pdfjs-dist');
    try {
        const pdfWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        const isCapacitor = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
        if (isCapacitor) {
            const version = pdfjsLib.version || '5.6.205';
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
        } else {
            pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
        }
    } catch (e) {
        console.warn("Could not set PDF worker source", e);
    }

    const arrayBuffer = await file.arrayBuffer();
    const fullText = [];
    
    // Attempt parsing with password if provided
    let pdf;
    try {
        pdf = await pdfjsLib.getDocument({
            data: arrayBuffer,
            password: password
        }).promise;
    } catch (error) {
        if (error.name === 'PasswordException') {
            throw error; // Re-throw to be caught by the UI
        }
        throw new Error('Failed to parse PDF: ' + error.message);
    }

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const rows = groupTextItemsByRow(textContent.items);
        fullText.push(...rows);
    }

    // Attempt to detect Bank Name from the header (first 50 rows) to avoid matching IFSC codes in transactions
    const headerText = fullText.slice(0, 50).join(' ').toLowerCase();
    let bankName = 'Bank Account';
    if (headerText.includes('indian bank') || /\bidib0/i.test(headerText)) bankName = 'Indian Bank';
    else if (headerText.includes('canara') || /\bcnrb0/i.test(headerText)) bankName = 'Canara Bank';
    else if (headerText.includes('sbi ') || headerText.includes('state bank') || /\bsbin0/i.test(headerText)) bankName = 'SBI';
    else if (headerText.includes('hdfc') || /\bhdfc0/i.test(headerText)) bankName = 'HDFC Bank';
    else if (headerText.includes('icici') || /\bicic0/i.test(headerText)) bankName = 'ICICI Bank';
    else if (headerText.includes('axis') || /\butib0/i.test(headerText)) bankName = 'Axis Bank';
    else if (headerText.includes('kotak') || /\bkkbk0/i.test(headerText)) bankName = 'Kotak Bank';

    // Attempt to detect Account Number ending
    let accountEnding = null;
    const rawStr = fullText.join(' ');
    // Matches patterns like "A/C No. 1234567890", "Account: xxxxxxxx1234"
    const accMatch = rawStr.match(/(?:a\/c|account)(?:\s+no\.?)?(?:\s*number)?[\s:]*(?:[x*X]+)?(\d{4,})/i);
    if (accMatch && accMatch[1]) {
        const digits = accMatch[1];
        accountEnding = digits.length >= 4 ? digits.substring(digits.length - 4) : digits;
    }

    // Extract Opening and Ending balance from PDF header
    const headerBlock = fullText.slice(0, 80).join(' ');
    let openingBalance = null;
    const openMatch = headerBlock.match(/opening\s+balance\s*(?:inr|rs\.?|₹)?\s*([\d,]+\.\d{2})/i);
    if (openMatch) openingBalance = parseFloat(openMatch[1].replace(/,/g, ''));

    const transactions = normalizePDFRows(fullText, bankName, accountEnding, file.lastModified, openingBalance);
    return transactions;
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

// Heuristic Normalizer for Text-Based PDF Rows
const normalizePDFRows = (rows, bankName = 'Bank Account', accountEnding = null, fileLastModifiedMs = null, openingBalance = null) => {
    // Regex for date: Supports DD/MM/YYYY, YYYY-MM-DD, DD.MM.YYYY, and textual months like 12 Jan 2024
    const dateRegex = /(\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b)|(\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b)|(\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4}\b)/i;

    const transactions = [];
    let currentBlock = null;

    const processBlock = (block) => {
        let cleanText = block.text.replace(/Ending Balance.*$/igm, '');
        cleanText = cleanText.replace(/Closing Balance.*$/igm, '');
        cleanText = cleanText.replace(/Total.*$/igm, '');
        cleanText = cleanText.replace(/DISCLAIMER.*$/igm, '');
        const remaining = cleanText;
        const moneyRegex = /([\d,]+\.\d{2})/g;
        const amounts = [...remaining.matchAll(moneyRegex)].map(m => parseFloat(m[0].replace(/,/g, '')));

        if (amounts.length > 0) {
            let amount = 0;
            let type = 'expense';

            if (amounts.length >= 3) {
                const withdrawal = amounts[amounts.length - 3];
                const deposit = amounts[amounts.length - 2];
                if (withdrawal > 0) { amount = withdrawal; type = 'expense'; }
                else if (deposit > 0) { amount = deposit; type = 'income'; }
                else { amount = amounts[0]; }
            } else if (amounts.length === 2) {
                amount = amounts[0];
            } else {
                amount = amounts[0];
            }

            const description = remaining.replace(moneyRegex, '').trim().replace(/\s+/g, ' ');

            let dateObj = new Date(block.dateStr);
            const isNumericDate = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(block.dateStr);
            if (isNumericDate) {
                const parts = block.dateStr.split(/[\/\-]/);
                if (parts[0].length === 4) dateObj = new Date(block.dateStr);
                else if (parseInt(parts[0]) > 12) dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                else dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }

            const isoDatePart = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            let finalDateStr = isoDatePart + 'T23:59:59.999Z';
            if (fileLastModifiedMs) {
                const fileDate = new Date(fileLastModifiedMs);
                const fileDatePart = fileDate.toISOString().split('T')[0];
                if (isoDatePart === fileDatePart) finalDateStr = fileDate.toISOString();
            }

            let availableBalance = null;
            if (amounts.length >= 2) availableBalance = amounts[amounts.length - 1];

            transactions.push({
                date: finalDateStr,
                description: description || 'PDF Import',
                amount: amount,
                type: type,
                categoryId: '',
                bankName: bankName,
                accountEnding: accountEnding,
                availableBalance: availableBalance,
                originalRow: block.text
            });
            return true;
        }
        return false;
    };

    let pendingPrefixText = '';

    rows.forEach(row => {
        const dateMatch = row.match(dateRegex);
        if (dateMatch) {
            if (currentBlock) {
                const hasAmounts = processBlock(currentBlock);
                if (!hasAmounts) {
                    pendingPrefixText += ' ' + currentBlock.dateStr + ' ' + currentBlock.text;
                } else {
                    pendingPrefixText = '';
                }
            }
            currentBlock = { dateStr: dateMatch[0], text: (pendingPrefixText + ' ' + row.replace(dateMatch[0], '')).trim() };
            pendingPrefixText = '';
        } else if (currentBlock) {
            currentBlock.text += ' ' + row.trim();
        }
    });
    if (currentBlock) processBlock(currentBlock);

    // ── Post-Processing: Balance-Comparison Type Correction ──────────────
    // The heuristic type detection above is unreliable for many PDF formats.
    // Instead, we use the DEFINITIVE balance column: if the balance went DOWN,
    // it was an expense; if it went UP, it was income. This is mathematically
    // guaranteed to be correct when consecutive balances are present.
    //
    // Step 1: Filter out any spurious "transaction" from the header area
    // (e.g., "Opening Balance: 612.00" parsed as a fake transaction)
    const filtered = transactions.filter(t => {
        const descLow = (t.description || '').toLowerCase();
        if (descLow.includes('account details') || descLow.includes('account summary') ||
            descLow.includes('account holder') || descLow.includes('for period')) {
            return false;
        }
        return true;
    });

    // Step 2: Use openingBalance (from header) as the "previous balance" for the first real transaction
    let prevBalance = openingBalance;

    for (let i = 0; i < filtered.length; i++) {
        const curr = filtered[i];
        if (curr.availableBalance != null && prevBalance != null) {
            const balDiff = curr.availableBalance - prevBalance;
            if (Math.abs(balDiff) > 0.005) {
                // Balance changed → determine type from direction
                curr.type = balDiff > 0 ? 'income' : 'expense';
                curr.amount = Math.abs(balDiff);
            }
            // If balDiff is ~0 (rounding), keep original heuristic
        }
        // Update prevBalance for next iteration
        if (curr.availableBalance != null) {
            prevBalance = curr.availableBalance;
        }
    }

    return filtered;
};

// Parse XLSX/XLS files using SheetJS
const parseXLSX = async (file) => {
    const XLSX = await import('xlsx');
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
    const mammothMod = await import('mammoth/mammoth.browser');
    const mammoth = mammothMod.default || mammothMod;
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
