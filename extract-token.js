import fs from 'fs';
import path from 'path';

const dir = path.join(process.env.APPDATA, 'personal-finance-app/IndexedDB/https_personal-finance-app-mauve.vercel.app_0.indexeddb.leveldb');

function search() {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        if (f.endsWith('.log') || f.endsWith('.ldb')) {
            try {
                const buf = fs.readFileSync(path.join(dir, f));
                const text = buf.toString('utf8');
                let idx = text.indexOf('stsTokenManager');
                if (idx !== -1) {
                    console.log(`Found stsTokenManager in ${f} at index ${idx}`);
                    // Let's find the enclosing JSON object.
                    // Since it is serialized, we can look for '{' and '}' around it.
                    let start = text.lastIndexOf('{', idx);
                    let end = text.indexOf('}', idx);
                    
                    // Let's print the raw characters around it
                    console.log("Raw slice:");
                    console.log(text.substring(idx - 100, idx + 800));
                }
            } catch(e) {
                // ignore
            }
        }
    }
}

search();
