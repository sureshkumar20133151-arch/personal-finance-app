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
    const tokenRes = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });
    
    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;

    const docRes = await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/do139V31SkRXMSpkLIW1AroA9ZO2`, {
        headers: {
            'Authorization': `Bearer ${idToken}`
        }
    });

    const docData = await docRes.json();
    const data = fromFirestore(docData.fields || {});
    
    console.log("Active Database Email:", data.email);
    console.log("Active Database Total Transactions:", data.transactions?.length);

    // Filter cash related transactions
    const allTx = data.transactions || [];
    
    // Let's inspect the cash calculations exactly like FinanceContext.jsx
    const cashIn = allTx.filter(t => t.type === "income" && t.paymentMode === "cash");
    const atmOut = allTx.filter(t =>
      t.type === "expense" &&
      (
        (t.description?.toLowerCase().includes("atm") && !t.description?.toLowerCase().includes("atm service branch")) || 
        t.description?.toLowerCase().includes("cash withdrawal")
      )
    );
    const cashOut = allTx.filter(t =>
      (t.type === "expense" || t.type === "debt") &&
      t.paymentMode === "cash" &&
      !(
        (t.description?.toLowerCase().includes("atm") && !t.description?.toLowerCase().includes("atm service branch")) || 
        t.description?.toLowerCase().includes("cash withdrawal")
      )
    );

    console.log("CASH INFLOW:", cashIn.reduce((s,t)=>s+t.amount, 0));
    console.log("ATM WITHDRAWALS (inflow to wallet):", atmOut.reduce((s,t)=>s+t.amount,0));
    atmOut.forEach(t => console.log(`  - Date: ${t.date}, Amt: ${t.amount}, Desc: ${t.description}, Bank: ${t.bankName}`));
    
    console.log("CASH OUTFLOW:", cashOut.reduce((s,t)=>s+t.amount,0));
    cashOut.forEach(t => console.log(`  - Date: ${t.date}, Amt: ${t.amount}, Desc: ${t.description}`));

    console.log("Calculated Cash Balance:", (data.initialCashBalance || 0) + cashIn.reduce((s,t)=>s+t.amount, 0) + atmOut.reduce((s,t)=>s+t.amount,0) - cashOut.reduce((s,t)=>s+t.amount,0));

    fs.writeFileSync('scratch/user_firebase_data_after.json', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error:", e.stack);
  }
}

main();
