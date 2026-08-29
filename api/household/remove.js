import { requireAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { applyCors } from "../_lib/cors.js";

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

  // memberUid omitted => the caller is leaving themselves.
  // memberUid provided => the caller (must be owner) is removing that member.
  const { memberUid } = req.body || {};
  const targetUid = memberUid || decoded.uid;

  const db = adminDb();

  try {
    const callerRef = db.doc(`users/${decoded.uid}`);
    const callerSnap = await callerRef.get();
    const householdId = callerSnap.data()?.householdId;
    if (!householdId) {
      return res.status(400).json({ error: "You don't belong to a household" });
    }

    const householdRef = db.doc(`households/${householdId}`);

    await db.runTransaction(async (tx) => {
      const householdSnap = await tx.get(householdRef);
      if (!householdSnap.exists) {
        const err = new Error("Household not found");
        err.statusCode = 404;
        throw err;
      }
      const household = householdSnap.data();
      const isOwner = household.ownerId === decoded.uid;

      if (targetUid !== decoded.uid && !isOwner) {
        const err = new Error("Only the household owner can remove other members");
        err.statusCode = 403;
        throw err;
      }
      if (targetUid === household.ownerId) {
        if ((household.memberIds || []).length <= 1) {
          // Delete 1-person household completely
          tx.delete(householdRef);
          tx.set(db.doc(`users/${targetUid}`), { householdId: null }, { merge: true });
          return;
        } else {
          const err = new Error(
            "Owners can't leave while other members remain in the household. Remove all other members first."
          );
          err.statusCode = 400;
          throw err;
        }
      }
      if (!household.memberIds.includes(targetUid)) {
        const err = new Error("That user is not a member of this household");
        err.statusCode = 404;
        throw err;
      }

      tx.update(householdRef, {
        memberIds: household.memberIds.filter((id) => id !== targetUid),
      });
      tx.set(db.doc(`users/${targetUid}`), { householdId: null }, { merge: true });
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("household/remove failed", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Could not remove member" });
  }
}
