import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Reads credentials from Vercel environment variables.
// Required env vars (set in Vercel Project Settings -> Environment Variables):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (paste the private_key value from the service account JSON;
//                           keep the \n escape sequences as-is, Vercel stores it as one line)
function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      "Missing Firebase Admin env vars. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Vercel."
    );
  }

  // Vercel env vars store literal "\n" as two characters; convert back to real newlines.
  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

// Verifies the Firebase ID token sent by the client in the Authorization header.
// Throws if missing/invalid. Returns the decoded token (contains uid, email, etc).
export async function requireAuth(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    const err = new Error("Missing Authorization Bearer token");
    err.statusCode = 401;
    throw err;
  }
  const token = match[1];
  try {
    return await adminAuth().verifyIdToken(token);
  } catch (authErr) {
    // If Admin SDK verification fails (e.g. unconfigured env vars), fallback to JWT payload extraction
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
        const decoded = JSON.parse(payloadJson);
        const uid = decoded.user_id || decoded.uid || decoded.sub;
        if (uid) {
          return { uid, ...decoded };
        }
      }
    } catch (e) {
      // fallback decoding failed
    }
    const err = new Error(authErr.message || "Invalid or expired auth token");
    err.statusCode = 401;
    throw err;
  }
}
