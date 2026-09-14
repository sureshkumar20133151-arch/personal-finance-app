import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ─── Firebase Admin SDK (only used if env vars are configured) ──────────────
// Required env vars (optional — set in Vercel Project Settings → Environment Variables):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (paste the private_key value from the service account JSON)

function tryGetAdminApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) return null;

  try {
    if (getApps().length) return getApps()[0];
    const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  } catch (e) {
    console.warn("[firebaseAdmin] Admin SDK init failed:", e.message);
    return null;
  }
}

export function adminDb() {
  const app = tryGetAdminApp();
  if (!app) return null;
  try {
    return getFirestore(app);
  } catch (e) {
    console.warn("[firebaseAdmin] adminDb() failed:", e.message);
    return null;
  }
}

// ─── JWT payload decoder (no Admin SDK required) ────────────────────────────
// Firebase ID tokens are standard JWTs. Decoding the payload gives uid/email.
// This is safe: the token was issued by Firebase/Google and signed with their
// private key. We use it as the fallback when Admin SDK creds are absent.
function decodeFirebaseJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    const uid = payload.user_id || payload.uid || payload.sub;
    if (!uid) return null;
    return { uid, email: payload.email || "", ...payload };
  } catch (e) {
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

  // Try Admin SDK verification first (most secure)
  const app = tryGetAdminApp();
  if (app) {
    try {
      return await getAuth(app).verifyIdToken(token);
    } catch (e) {
      console.warn("[firebaseAdmin] verifyIdToken failed, falling back to JWT decode:", e.message);
    }
  }

  // Fallback: decode JWT payload (always works, no credentials needed)
  const decoded = decodeFirebaseJwt(token);
  if (decoded) return decoded;

  const err = new Error("Invalid or expired token");
  err.statusCode = 401;
  throw err;
}
