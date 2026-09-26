const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function testPdf() {
    const data = new Uint8Array(fs.readFileSync('AccountStatement_09-06-2026 21_28_22 (1).pdf'));
    const doc = await pdfjsLib.getDocument(data).promise;
    const page = await doc.getPage(1);
    const textContent = await page.getTextContent();
    const items = textContent.items.map(i => i.str);
    console.log(items.slice(0, 50).join(' '));
}
testPdf().catch(console.error);
