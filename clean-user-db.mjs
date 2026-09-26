import fs from 'fs';

const firebaseConfig = {
    apiKey: "AIzaSyCfLLfHSHiWEGrcwct9NdLk8hHS4V0DSEU",
    projectId: "billing-dc0b2"
};

const refreshToken = "AMf-vBy67DqZ0l7XyTEBIo9NB55T_zwowgMMKhTTpN10TTjgNckTl-06ctMeb5ICjtreTIVJGXq6s3rwIwM0SELFcgP_s6j-tEUp4dZ1SG8RNfZM8ZtMpis52XDWpMyfxBo0BgBqUDQDy9SxPQwNlG8rA3ybDJKWN1upM0C4B9Ihkb4q4Pk5zSv9iAeILb9DgeZ22j7Dh8zw-P_kTfkDOA6pXToVv7KI911m2HPfbthKWip53lqnI_FC-TE-kSbnEA6VLFi4ILLLCWLLLfg5N1FDhQnVA5_XrgpBH8c7MypNgzan9vhKHkc";

// Helper to convert simple JS object to Firestore Document format
function toFirestoreValue(val) {
    if (val === null) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') {
        if (Number.isInteger(val)) return { integerValue: val };
        return { doubleValue: val };
    }
    if (typeof val === 'boolean') return { booleanValue: val };
    if (Array.isArray(val)) {
        return { arrayValue: { values: val.map(toFirestoreValue) } };
    }
    if (typeof val === 'object') {
        const fields = {};
        for (const [k, v] of Object.entries(val)) {
            fields[k] = toFirestoreValue(v);
        }
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

async function main() {
  try {
    console.log("Refreshing ID Token...");
    const tokenRes = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });
    
    if (!tokenRes.ok) {
        throw new Error(`Failed to refresh token: ${tokenRes.statusText}`);
    }
    
    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;
    console.log("Token refreshed.");

    // Read local backup of database
    const localData = JSON.parse(fs.readFileSync('scratch/user_firebase_data.json', 'utf8'));
    
    console.log("Original Transactions count:", localData.transactions?.length);

    // Apply the clean filter
    const cleanTxs = localData.transactions.filter(t => {
        if (!t.bankName || t.bankName === 'Bank Account' || t.bankName === 'Unknown Bank') return false;
        if (!t.accountEnding || t.accountEnding === 'null' || t.accountEnding === '975') {
            if (t.bankName === 'GPay/UPI' || t.bankName === 'PhonePe') return true;
            return false;
        }
        return true;
    });

    console.log("Cleaned Transactions count:", cleanTxs.length);

    // Let's summarize the clean counts
    const cleanCounts = {};
    cleanTxs.forEach(t => {
        const k = t.bankName + '_' + t.accountEnding;
        cleanCounts[k] = (cleanCounts[k] || 0) + 1;
    });
    console.log("Cleaned transaction groups:", cleanCounts);

    // Update the database
    console.log("Uploading cleaned transactions to Firestore...");
    const firestoreValue = toFirestoreValue(cleanTxs);
    
    const patchRes = await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/do139V31SkRXMSpkLIW1AroA9ZO2?updateMask.fieldPaths=transactions`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fields: {
                transactions: firestoreValue
            }
        })
    });

    if (!patchRes.ok) {
        const errText = await patchRes.text();
        throw new Error(`Failed to update Firestore: ${patchRes.status} ${patchRes.statusText}\n${errText}`);
    }

    console.log("DATABASE CLEANED SUCCESSFULLY!");

  } catch (e) {
    console.error("Error:", e.stack);
  }
}

main();
