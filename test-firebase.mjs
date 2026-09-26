import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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
    const snapshot = await getDocs(collection(db, "users"));
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.email === "sureshkumar20133151@gmail.com" || data.transactions?.length > 0) {
            console.log("\nFound User:", data.email || doc.id);
            const txs = data.transactions || [];
            console.log("Total Transactions:", txs.length);
            
            // Filter and sort by date descending
            const sorted = txs.sort((a,b) => new Date(b.date) - new Date(a.date));
            
            const indian = sorted.filter(t => t.bankName === 'Indian Bank');
            console.log("\n--- Last 5 Indian Bank Transactions ---");
            indian.slice(0, 5).forEach(t => console.log(`${t.date} | ${t.type} | Amt: ${t.amount} | Bal: ${t.availableBalance} | SMS: ${t.rawSms?.substring(0, 50)}...`));

            const canara = sorted.filter(t => t.bankName === 'Canara Bank');
            console.log("\n--- Last 5 Canara Bank Transactions ---");
            canara.slice(0, 5).forEach(t => console.log(`${t.date} | ${t.type} | Amt: ${t.amount} | Bal: ${t.availableBalance} | SMS: ${t.rawSms?.substring(0, 50)}...`));
        }
    });
  } catch (e) {
    console.error("Error reading users:", e.message);
  }
  process.exit();
}
check();
