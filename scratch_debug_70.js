import fs from 'fs';

const report = JSON.parse(fs.readFileSync('C:/Users/ADMIN/.gemini/antigravity/brain/c5f63ff3-3e88-4168-b562-d0de544d173b/scratch/comparison_report.json', 'utf8'));

console.log("Matches details:");
report.matches.forEach((m, i) => {
    if (m.pdf.amount === 70) {
        console.log(`Match ${i}:`);
        console.log("  PDF Date:", m.pdf.date, "Parsed:", m.pdf.parsedDate, "Bal:", m.pdf.balance);
        console.log("  DB Date:", m.db.date, "Parsed:", m.db.parsedDate, "Bal:", m.db.availableBalance);
    }
});

console.log("\nExtra in DB:");
report.extraInDb.forEach((e, i) => {
    if (e.amount === 70) {
        console.log(`Extra ${i}:`);
        console.log("  DB Date:", e.date, "Parsed:", e.parsedDate, "Bal:", e.availableBalance);
    }
});
