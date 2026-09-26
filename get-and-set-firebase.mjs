import fs from 'fs';

const firebaseConfig = {
    apiKey: "AIzaSyCfLLfHSHiWEGrcwct9NdLk8hHS4V0DSEU",
    projectId: "billing-dc0b2"
};

const refreshToken = "AMf-vBy67DqZ0l7XyTEBIo9NB55T_zwowgMMKhTTpN10TTjgNckTl-06ctMeb5ICjtreTIVJGXq6s3rwIwM0SELFcgP_s6j-tEUp4dZ1SG8RNfZM8ZtMpis52XDWpMyfxBo0BgBqUDQDy9SxPQwNlG8rA3ybDJKWN1upM0C4B9Ihkb4q4Pk5zSv9iAeILb9DgeZ22j7Dh8zw-P_kTfkDOA6pXToVv7KI911m2HPfbthKWip53lqnI_FC-TE-kSbnEA6VLFi4ILLLCWLLLfg5N1FDhQnVA5_XrgpBH8c7MypNgzan9vhKHkc";

function parseValue(v) {
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
    if (v.integerValue !== undefined) return parseInt(v.integerValue);
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.nullValue !== undefined) return null;
    if (v.arrayValue !== undefined) {
        return (v.arrayValue.values || []).map(parseValue);
    }
    if (v.mapValue !== undefined) {
        return fromFirestore(v.mapValue.fields || {});
    }
    return v;
}

function fromFirestore(fields) {
    const res = {};
    for (const [k, v] of Object.entries(fields)) {
        res[k] = parseValue(v);
    }
    return res;
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
    console.log("Token refreshed successfully.");

    console.log("Fetching user document from Firestore REST API...");
    const docRes = await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/do139V31SkRXMSpkLIW1AroA9ZO2`, {
        headers: {
            'Authorization': `Bearer ${idToken}`
        }
    });

    if (!docRes.ok) {
        throw new Error(`Failed to fetch document: ${docRes.status} ${docRes.statusText}`);
    }

    const docData = await docRes.json();
    console.log("Document fetched successfully!");

    const data = fromFirestore(docData.fields || {});
    console.log("Email:", data.email);
    console.log("Total Transactions:", data.transactions?.length);
    console.log("Starting bank balances:", JSON.stringify(data.initialBankBalances));
    console.log("Starting cash balance:", data.initialCashBalance);
    console.log("Cash seed date:", data.cashSeedDate);

    fs.writeFileSync('scratch/user_firebase_data.json', JSON.stringify(data, null, 2));
    console.log("Wrote simplified user data to scratch/user_firebase_data.json");
  } catch (e) {
    console.error("Error:", e.stack);
  }
}

main();
