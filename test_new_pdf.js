import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

const groupTextItemsByRow = (items) => {
    const rows = [];
    const tolerance = 5;
    items.sort((a, b) => {
        if (Math.abs(b.transform[5] - a.transform[5]) > tolerance) {
            return b.transform[5] - a.transform[5];
        }
        return a.transform[4] - b.transform[4];
    });

    let currentRow = [];
    let currentY = null;

    items.forEach(item => {
        if (currentY === null) {
            currentY = item.transform[5];
            currentRow.push(item.str);
        } else if (Math.abs(currentY - item.transform[5]) <= tolerance) {
            currentRow.push(item.str);
        } else {
            rows.push(currentRow.join(' '));
            currentRow = [item.str];
            currentY = item.transform[5];
        }
    });
    if (currentRow.length > 0) {
        rows.push(currentRow.join(' '));
    }
    return rows;
};

async function testPdf() {
    const data = new Uint8Array(fs.readFileSync('AccountStatement_09-06-2026 23_27_47 (1).pdf'));
    const doc = await pdfjsLib.getDocument(data).promise;
    const fullText = [];
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        fullText.push(...groupTextItemsByRow(textContent.items));
    }

    const dateRegex = /(\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b)|(\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b)|(\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4}\b)/i;
    const moneyRegex = /([\d,]+\.\d{2})/g;
    
    const transactions = [];
    
    fullText.forEach((row, i) => {
        const dateMatch = row.match(dateRegex);
        if (dateMatch) {
            const dateStr = dateMatch[0];
            const remaining = row.replace(dateStr, '').trim();
            const amounts = [...remaining.matchAll(moneyRegex)].map(m => parseFloat(m[0].replace(/,/g, '')));
            
            if (amounts.length > 0) {
                transactions.push({
                    date: dateStr,
                    row: row,
                    amounts: amounts,
                    availableBalance: amounts.length >= 2 ? amounts[amounts.length - 1] : null
                });
            }
        }
    });

    console.log("TOTAL TRANSACTIONS:", transactions.length);
    console.log("LAST 10 TRANSACTIONS:");
    console.log(JSON.stringify(transactions.slice(-10), null, 2));
}

testPdf().catch(console.error);
