import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from 'fs';

const firebaseConfig = {
    apiKey: "AIzaSyBmyy7c2ScBC1xrAStSjhgkL-0ouvY5-Jo",
    authDomain: "listing-generator-31b39.firebaseapp.com",
    projectId: "listing-generator-31b39",
    storageBucket: "listing-generator-31b39.firebasestorage.app",
    messagingSenderId: "457615196609",
    appId: "1:457615196609:web:37c6b38cacc8f570a7af40"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  try {
    const userDoc = await getDoc(doc(db, "users", "do139V31SkRXMSpkLIW1AroA9ZO2"));
    if (userDoc.exists()) {
        const data = userDoc.data();
        console.log("Found User Document!");
        console.log("Email:", data.email);
        console.log("Total Transactions:", data.transactions?.length);
        console.log("Starting bank balances:", JSON.stringify(data.initialBankBalances));
        console.log("Starting cash balance:", data.initialCashBalance);
        console.log("Cash seed date:", data.cashSeedDate);

        // Let's write the entire data to a file for complete inspection
        fs.writeFileSync('scratch/user_firebase_data.json', JSON.stringify(data, null, 2));
        console.log("Wrote full user data to scratch/user_firebase_data.json");
    } else {
        console.log("No user document found for UID do139V31SkRXMSpkLIW1AroA9ZO2");
    }
  } catch (e) {
    console.error("Error reading user:", e.message);
  }
  process.exit();
}
check();
