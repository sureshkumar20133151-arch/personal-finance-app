import { requireAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { seatLimitFor } from "../_lib/plans.js";
import { applyCors } from "../_lib/cors.js";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── Sub-handlers ────────────────────────────────────────────────────────────

async function handleCreate(req, res, decoded, db) {
  const { name } = req.body || {};
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

async function handleInvite(req, res, decoded, db) {
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

async function handleAccept(req, res, decoded, db) {
  const code = (req.body?.code || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: "Enter an invite code" });
  }

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

      const existingHouseholdId = userSnap.data()?.householdId;
      if (existingHouseholdId) {
        if (existingHouseholdId === householdId) {
          const err = new Error("You're already a member of this household");
          err.statusCode = 409;
          throw err;
        }
        const existingSnap = await tx.get(db.doc(`households/${existingHouseholdId}`));
        if (existingSnap.exists && (existingSnap.data()?.memberIds || []).length <= 1) {
          tx.delete(db.doc(`households/${existingHouseholdId}`));
        } else if (existingSnap.exists) {
          const err = new Error("You're currently in another household with active members. Please leave it first.");
          err.statusCode = 409;
          throw err;
        }
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

async function handleRemove(req, res, decoded, db) {
  const { memberUid } = req.body || {};
  const targetUid = memberUid || decoded.uid;

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

// ─── Main Dispatcher ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const rawAction = req.query?.action || req.url?.split("?")[0].split("/").pop();
  const action = String(rawAction || "").toLowerCase().trim();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message });
  }

  const db = await adminDb();
  if (!db) {
    return res.status(500).json({ error: "Server database not configured" });
  }

  switch (action) {
    case "create":
      return handleCreate(req, res, decoded, db);
    case "invite":
      return handleInvite(req, res, decoded, db);
    case "accept":
      return handleAccept(req, res, decoded, db);
    case "remove":
      return handleRemove(req, res, decoded, db);
    default:
      return res.status(404).json({ error: `Unknown household action: ${action}` });
  }
}
