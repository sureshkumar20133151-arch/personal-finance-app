import { requireAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { seatLimitFor } from "../_lib/plans.js";
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

  const code = (req.body?.code || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: "Enter an invite code" });
  }

  const db = adminDb();

  try {
    const codeSnap = await db.doc(`householdInviteCodes/${code}`).get();
    if (!codeSnap.exists) {
      return res.status(404).json({ error: "Invalid or expired invite code" });
    }
    const { householdId } = codeSnap.data();
    const householdRef = db.doc(`households/${householdId}`);
    const userRef = db.doc(`users/${decoded.uid}`);

    const result = await db.runTransaction(async (tx) => {
      const [householdSnap, userSnap] = await Promise.all([
        tx.get(householdRef),
        tx.get(userRef),
      ]);

      if (!householdSnap.exists) {
        const err = new Error("Household no longer exists");
        err.statusCode = 404;
        throw err;
      }
      const household = householdSnap.data();

      if (userSnap.data()?.householdId) {
        const err = new Error("You're already in a household. Leave it first.");
        err.statusCode = 409;
        throw err;
      }
      if (household.memberIds.includes(decoded.uid)) {
        const err = new Error("You're already a member of this household");
        err.statusCode = 409;
        throw err;
      }

      const ownerRef = db.doc(`users/${household.ownerId}`);
      const ownerDoc = await tx.get(ownerRef);
      const ownerSubscription = ownerDoc.data()?.subscription || "free";
      const limit = seatLimitFor(ownerSubscription);

      if (household.memberIds.length >= limit) {
        let msg = `This household is full (${limit} member${limit === 1 ? "" : "s"} max on the owner's current plan).`;
        if (ownerSubscription === 'free') {
          msg = "This household is full. Free plan is 1-person only. Upgrade to Starter (2 members) or Pro (4 members) to invite family.";
        } else if (ownerSubscription === 'starter') {
          msg = "This household is full. Starter plan allows 2 members total (owner + 1 invited person). Upgrade to Pro for up to 4 members.";
        }
        const err = new Error(msg);
        err.statusCode = 403;
        throw err;
      }

      tx.update(householdRef, { memberIds: [...household.memberIds, decoded.uid] });
      tx.set(userRef, { householdId }, { merge: true });

      return { householdId, name: household.name };
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("household/accept failed", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Could not join household" });
  }
}
