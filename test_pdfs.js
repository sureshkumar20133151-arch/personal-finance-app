import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const workerPath = path.resolve('./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

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
        if (!item.str.trim()) return;
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

async function inspectPdf(filePath) {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const doc = await pdfjsLib.getDocument(data).promise;
    const fullText = [];
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        fullText.push(...groupTextItemsByRow(textContent.items));
    }
    return fullText;
}

async function main() {
    const indianText = await inspectPdf('AccountStatement_11-06-2026 21_35_19.pdf');
    const canaraText = await inspectPdf('canara_epassbook_2026-06-11 213638.439815.pdf');

    fs.writeFileSync('scratch/indian_text.txt', indianText.join('\n'));
    fs.writeFileSync('scratch/canara_text.txt', canaraText.join('\n'));
    console.log("PDF raw text written to scratch directory.");
}

main().catch(console.error);
