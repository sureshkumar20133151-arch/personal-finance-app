import { requireAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { applyCors } from "../_lib/cors.js";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message });
  }

  const { name } = req.body || {};
  const db = adminDb();
  const userRef = db.doc(`users/${decoded.uid}`);

  try {
    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const userData = userSnap.exists ? userSnap.data() : {};

      if (userData.householdId) {
        const err = new Error("You're already in a household. Leave it first.");
        err.statusCode = 409;
        throw err;
      }

      const householdRef = db.collection("households").doc();
      let code = generateInviteCode();
      let codeRef = db.collection("householdInviteCodes").doc(code);
      // Extremely unlikely collision, but guard anyway.
      let attempts = 0;
      while ((await tx.get(codeRef)).exists && attempts < 5) {
        code = generateInviteCode();
        codeRef = db.collection("householdInviteCodes").doc(code);
        attempts++;
      }

      tx.set(householdRef, {
        name: (name || "My Household").trim().slice(0, 60),
        ownerId: decoded.uid,
        memberIds: [decoded.uid],
        inviteCode: code,
        createdAt: new Date().toISOString(),
      });
      tx.set(codeRef, { householdId: householdRef.id, createdAt: new Date().toISOString() });
      tx.set(userRef, { householdId: householdRef.id }, { merge: true });

      return { householdId: householdRef.id, inviteCode: code };
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("household/create failed", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Could not create household" });
  }
}
