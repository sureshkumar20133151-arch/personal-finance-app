import { requireAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { applyCors } from "../_lib/cors.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message });
  }

  try {
    const db = await adminDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    const snapshot = await db
      .collection(`users/${decoded.uid}/invoices`)
      .orderBy("invoiceDate", "desc")
      .limit(50)
      .get();

    const invoices = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ invoices });
  } catch (err) {
    console.error("Failed to fetch invoices:", err);
    return res.status(500).json({ error: "Could not fetch invoices" });
  }
}
