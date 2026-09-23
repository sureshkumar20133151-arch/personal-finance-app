// ─────────────────────────────────────────────────────────────────────────────
//  OAuth 2.0 Authorization Endpoint (RFC 6749)
//  Handles GET (renders consent UI) and POST (issues authorization code)
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';

const BUDGET_TRACKER_PROJECT = 'listing-generator-31b39';
let _mcpDb = null;

async function getMcpDb() {
  if (_mcpDb) return _mcpDb;
  const projectId   = process.env.MCP_FIREBASE_PROJECT_ID   || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.MCP_FIREBASE_CLIENT_EMAIL  || process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey      = process.env.MCP_FIREBASE_PRIVATE_KEY   || process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) return null;

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const appName = 'mcp-oauth-auth';
    const existing = getApps().find(a => a.name === appName);
    const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
    const app = existing || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, appName);
    _mcpDb = getFirestore(app);
    return _mcpDb;
  } catch (e) {
    console.error('[OAuth Authorize] Admin init error:', e.message);
    return null;
  }
}

function decodeFirebaseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
    const uid = payload.user_id || payload.uid || payload.sub;
    if (!uid) return null;
    return { uid, email: payload.email || '', name: payload.name || '' };
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── POST: Exchange Firebase ID Token for OAuth Authorization Code ─────────
  if (req.method === 'POST') {
    try {
      const { idToken, clientId, redirectUri, state, codeChallenge, codeChallengeMethod, scope } = req.body || {};

      if (!idToken || !redirectUri) {
        return res.status(400).json({ error: 'Missing required parameters (idToken, redirectUri)' });
      }

      const user = decodeFirebaseJwt(idToken);
      if (!user || !user.uid) {
        return res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
      }

      // Generate secure 32-byte authorization code
      const code = 'bt_code_' + crypto.randomBytes(24).toString('hex');
      const now = Date.now();
      const expiresAt = now + 5 * 60 * 1000; // 5 minutes TTL

      const db = await getMcpDb();
      if (!db) {
        return res.status(500).json({ error: 'Database connection failed.' });
      }

      await db.collection('oauth_codes').doc(code).set({
        code,
        uid: user.uid,
        email: user.email,
        name: user.name || '',
        clientId: clientId || 'claude-connector',
        redirectUri,
        codeChallenge: codeChallenge || '',
        codeChallengeMethod: codeChallengeMethod || 'S256',
        scope: scope || 'finance:read finance:write',
        createdAt: now,
        expiresAt,
      });

      // Automatically sync profile name and email to Firestore user document
      try {
        const userRef = db.collection('users').doc(user.uid);
        const uSnap = await userRef.get().catch(() => null);
        const existingData = (uSnap && uSnap.exists) ? uSnap.data() : {};
        const profileUpdates = { email: user.email };
        if (user.name) {
          profileUpdates.displayName = user.name;
          const currentProfile = existingData.profile || {};
          if (!currentProfile.displayName && !currentProfile.firstName) {
            const [first, ...rest] = user.name.split(' ');
            profileUpdates.profile = {
              ...currentProfile,
              displayName: user.name,
              firstName: first || user.name,
              lastName: rest.join(' ') || '',
            };
          }
        }
        await userRef.set(profileUpdates, { merge: true }).catch(() => {});
      } catch (profErr) {
        console.warn('[OAuth] Could not sync user profile info:', profErr.message);
      }

      // Construct redirect URL
      const targetUrl = new URL(redirectUri);
      targetUrl.searchParams.set('code', code);
      if (state) targetUrl.searchParams.set('state', state);

      return res.status(200).json({ redirectUrl: targetUrl.toString() });
    } catch (e) {
      console.error('[OAuth Authorize POST error]:', e);
      return res.status(500).json({ error: e.message || 'Server error' });
    }
  }

  // ── GET: Render Branded OAuth Consent HTML Page ───────────────────────────
  if (req.method === 'GET') {
    const {
      client_id = '',
      redirect_uri = '',
      response_type = 'code',
      state = '',
      code_challenge = '',
      code_challenge_method = 'S256',
      scope = 'finance:read finance:write',
    } = req.query || {};

    if (!redirect_uri) {
      return res.status(400).send('<h2>Invalid OAuth Request: Missing redirect_uri parameter.</h2>');
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect Claude to Budget Tracker Pro</title>
  <link rel="icon" type="image/png" href="/app-icon-512.png">
  <style>
    :root {
      --bg: #090d16;
      --card: #111827;
      --border: #1f2937;
      --primary: #10b981;
      --primary-hover: #059669;
      --text: #f9fafb;
      --text-muted: #9ca3af;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body {
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .card {
      background-color: var(--card);
      border: 1px solid var(--border);
      border-radius: 1.25rem;
      width: 100%;
      max-width: 440px;
      padding: 2rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }
    .header {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .logo {
      width: 64px;
      height: 64px;
      border-radius: 1rem;
      margin-bottom: 1rem;
      box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);
    }
    h1 { font-size: 1.35rem; font-weight: 700; margin-bottom: 0.35rem; }
    p.subtitle { color: var(--text-muted); font-size: 0.875rem; }
    
    .permissions-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 0.85rem;
      padding: 1rem;
      margin: 1.25rem 0;
      font-size: 0.85rem;
    }
    .perm-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.65rem;
    }
    .perm-item:last-child { margin-bottom: 0; }
    .perm-icon { font-size: 1.1rem; }
    
    .user-profile {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 0.85rem;
      padding: 0.75rem 1rem;
      margin-bottom: 1.25rem;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #10b981;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }
    .user-info { overflow: hidden; }
    .user-name { font-weight: 600; font-size: 0.9rem; }
    .user-email { font-size: 0.75rem; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }

    .btn {
      width: 100%;
      padding: 0.75rem;
      border-radius: 0.75rem;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .btn-primary {
      background-color: var(--primary);
      color: white;
      margin-bottom: 0.75rem;
    }
    .btn-primary:hover { background-color: var(--primary-hover); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.05); color: var(--text); }

    .login-section { text-align: center; }
    .login-btn {
      background: #ffffff;
      color: #1f2937;
      margin-bottom: 0.75rem;
    }
    .login-btn:hover { background: #f3f4f6; }
    
    .loading-spinner {
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top-color: white;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .hidden { display: none !important; }
    .error-banner {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid var(--danger);
      color: #fca5a5;
      padding: 0.65rem;
      border-radius: 0.5rem;
      font-size: 0.8rem;
      margin-bottom: 1rem;
      text-align: center;
    }
  </style>

  <!-- Firebase Web SDK Modular (v10) -->
  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

    const firebaseConfig = {
      apiKey: "AIzaSyBmyy7c2ScBC1xrAStSjhgkL-0ouvY5-Jo",
      authDomain: "listing-generator-31b39.firebaseapp.com",
      projectId: "listing-generator-31b39",
      storageBucket: "listing-generator-31b39.firebasestorage.app",
      messagingSenderId: "457615196609",
      appId: "1:457615196609:web:37c6b38cacc8f570a7af40"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    const authSection = document.getElementById("auth-section");
    const loginSection = document.getElementById("login-section");
    const userAvatar = document.getElementById("user-avatar");
    const userName = document.getElementById("user-name");
    const userEmail = document.getElementById("user-email");
    const authorizeBtn = document.getElementById("authorize-btn");
    const googleLoginBtn = document.getElementById("google-login-btn");
    const cancelBtn = document.getElementById("cancel-btn");
    const errorBanner = document.getElementById("error-banner");

    let currentUser = null;

    function showError(msg) {
      errorBanner.textContent = msg;
      errorBanner.classList.remove("hidden");
    }

    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = user;
        loginSection.classList.add("hidden");
        authSection.classList.remove("hidden");

        userName.textContent = user.displayName || user.email?.split("@")[0] || "User";
        userEmail.textContent = user.email || "";
        userAvatar.textContent = (user.displayName || user.email || "U")[0].toUpperCase();
      } else {
        currentUser = null;
        authSection.classList.add("hidden");
        loginSection.classList.remove("hidden");
      }
    });

    googleLoginBtn.addEventListener("click", async () => {
      try {
        errorBanner.classList.add("hidden");
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } catch (err) {
        showError("Sign-in failed: " + err.message);
      }
    });

    authorizeBtn.addEventListener("click", async () => {
      if (!currentUser) return;
      try {
        authorizeBtn.disabled = true;
        authorizeBtn.innerHTML = '<span class="loading-spinner"></span> Authorizing...';

        const idToken = await currentUser.getIdToken();

        const res = await fetch("/api/oauth/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            clientId: "${client_id}",
            redirectUri: "${redirect_uri}",
            state: "${state}",
            codeChallenge: "${code_challenge}",
            codeChallengeMethod: "${code_challenge_method}",
            scope: "${scope}",
          }),
        });

        const data = await res.json();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          showError(data.error || "Authorization failed.");
          authorizeBtn.disabled = false;
          authorizeBtn.innerHTML = 'Authorize Claude';
        }
      } catch (err) {
        showError("Network error: " + err.message);
        authorizeBtn.disabled = false;
        authorizeBtn.innerHTML = 'Authorize Claude';
      }
    });

    cancelBtn.addEventListener("click", () => {
      const redirectUri = "${redirect_uri}";
      const targetUrl = new URL(redirectUri);
      targetUrl.searchParams.set("error", "access_denied");
      if ("${state}") targetUrl.searchParams.set("state", "${state}");
      window.location.href = targetUrl.toString();
    });
  </script>
</head>
<body>
  <div class="card">
    <div class="header">
      <img src="/app-icon-512.png" class="logo" alt="Budget Tracker Pro">
      <h1>Connect to Claude</h1>
      <p class="subtitle">Claude is requesting access to your Budget Tracker Pro account</p>
    </div>

    <div id="error-banner" class="error-banner hidden"></div>

    <!-- Logged in State -->
    <div id="auth-section" class="hidden">
      <div class="user-profile">
        <div id="user-avatar" class="avatar">U</div>
        <div class="user-info">
          <div id="user-name" class="user-name">Loading...</div>
          <div id="user-email" class="user-email">...</div>
        </div>
      </div>

      <div class="permissions-box">
        <div class="perm-item">
          <span class="perm-icon">📊</span>
          <span>Read your bank & cash balances</span>
        </div>
        <div class="perm-item">
          <span class="perm-icon">🔍</span>
          <span>View, search & summarize transactions</span>
        </div>
        <div class="perm-item">
          <span class="perm-icon">➕</span>
          <span>Add new transactions automatically</span>
        </div>
        <div class="perm-item">
          <span class="perm-icon">🏷️</span>
          <span>Manage your budget categories</span>
        </div>
      </div>

      <button id="authorize-btn" class="btn btn-primary">
        Authorize Claude
      </button>
      <button id="cancel-btn" class="btn btn-secondary">
        Cancel
      </button>
    </div>

    <!-- Not Logged In State -->
    <div id="login-section">
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem; text-align: center;">
        Please sign in with your Budget Tracker account to approve connection:
      </p>
      <button id="google-login-btn" class="btn login-btn">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
        Continue with Google
      </button>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
