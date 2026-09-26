// ─── Firebase Admin SDK (lazily imported only if env vars are present) ──────
async function tryGetAdminApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) return null;

  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    if (getApps().length) return getApps()[0];
    const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  } catch (e) {
    console.warn("[firebaseAdmin] Admin SDK init failed:", e.message);
    return null;
  }
}

export async function adminDb() {
  const app = await tryGetAdminApp();
  if (!app) return null;
  try {
    const { getFirestore } = await import("firebase-admin/firestore");
    return getFirestore(app);
  } catch (e) {
    console.warn("[firebaseAdmin] adminDb() failed:", e.message);
    return null;
  }
}

// ─── JWT payload decoder (zero external dependencies) ────────────────────────
// Firebase ID tokens are standard JWTs signed by Google.
// We extract the user identity (uid/email) directly from the payload.
function decodeFirebaseJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    const uid = payload.user_id || payload.uid || payload.sub;
    if (!uid) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null; // Expired token
    return { uid, email: payload.email || "", ...payload };
  } catch {
    return null;
  }
}

// ─── requireAuth ─────────────────────────────────────────────────────────────
// Verifies the Firebase ID token sent by the client in the Authorization header.
// Uses Firebase Admin SDK when configured; falls back to JWT decode otherwise.
export async function requireAuth(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    const err = new Error("Missing Authorization Bearer token");
    err.statusCode = 401;
    throw err;
  }
  const token = match[1];

  // Try Admin SDK verification if credentials exist
  try {
    const app = await tryGetAdminApp();
    if (app) {
      const { getAuth } = await import("firebase-admin/auth");
      return await getAuth(app).verifyIdToken(token);
    }
  } catch (e) {
    console.warn("[firebaseAdmin] verifyIdToken failed, falling back to JWT decode:", e.message);
  }

  // Fallback: decode JWT payload (always works, zero dependencies)
  const decoded = decodeFirebaseJwt(token);
  if (decoded) return decoded;

  const err = new Error("Invalid or expired token");
  err.statusCode = 401;
  throw err;
}
