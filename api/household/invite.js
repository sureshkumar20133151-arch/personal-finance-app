import { requireAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { applyCors } from "../_lib/cors.js";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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

  const db = adminDb();
  const userRef = db.doc(`users/${decoded.uid}`);

  try {
    const userSnap = await userRef.get();
    const householdId = userSnap.data()?.householdId;
    if (!householdId) {
      return res.status(400).json({ error: "You don't belong to a household" });
    }

    const householdRef = db.doc(`households/${householdId}`);
    const householdSnap = await householdRef.get();
    if (!householdSnap.exists) {
      return res.status(404).json({ error: "Household not found" });
    }
    if (householdSnap.data().ownerId !== decoded.uid) {
      return res.status(403).json({ error: "Only the household owner can generate invite codes" });
    }

    // Remove old codes pointing at this household so they stop working.
    const oldCodes = await db.collection("householdInviteCodes").where("householdId", "==", householdId).get();
    const batch = db.batch();
    oldCodes.forEach((docSnap) => batch.delete(docSnap.ref));

    const code = generateInviteCode();
    batch.set(db.collection("householdInviteCodes").doc(code), {
      householdId,
      createdAt: new Date().toISOString(),
    });
    batch.update(householdRef, { inviteCode: code });
    await batch.commit();

    return res.status(200).json({ success: true, inviteCode: code });
  } catch (err) {
    console.error("household/invite failed", err);
    return res.status(500).json({ error: "Could not generate invite code" });
  }
}
