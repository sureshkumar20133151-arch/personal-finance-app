// ─────────────────────────────────────────────────────────────────────────────
//  OAuth 2.0 Token Exchange Endpoint (RFC 6749, RFC 7636 PKCE)
//  Exchanges authorization code for JWT Bearer access token
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import { signAccessToken, verifyPkce } from '../_lib/oauthTokens.js';

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
    const appName = 'mcp-oauth-token';
    const existing = getApps().find(a => a.name === appName);
    const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
    const app = existing || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, appName);
    _mcpDb = getFirestore(app);
    return _mcpDb;
  } catch (e) {
    console.error('[OAuth Token] Admin init error:', e.message);
    return null;
  }
}

function parseParams(req) {
  // Support both JSON body and application/x-www-form-urlencoded
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    const params = new URLSearchParams(req.body);
    return Object.fromEntries(params.entries());
  }
  return req.query || {};
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', error_description: 'Only POST is supported.' });
  }

  const params = parseParams(req);
  const {
    grant_type,
    code,
    redirect_uri,
    client_id,
    code_verifier,
    refresh_token,
  } = params;

  const db = await getMcpDb();
  if (!db) {
    return res.status(500).json({ error: 'server_error', error_description: 'Database connection failed.' });
  }

  // ── Grant: authorization_code ─────────────────────────────────────────────
  if (grant_type === 'authorization_code') {
    if (!code) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing code parameter.' });
    }

    const codeRef = db.collection('oauth_codes').doc(code);
    const snap = await codeRef.get();

    if (!snap.exists) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code.' });
    }

    const record = snap.data();

    // Verify expiration
    if (Date.now() > (record.expiresAt || 0)) {
      await codeRef.delete().catch(() => {});
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code has expired.' });
    }

    // Verify redirect_uri
    if (redirect_uri && record.redirectUri && redirect_uri !== record.redirectUri) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri does not match original request.' });
    }

    // Verify PKCE if a challenge was provided during /authorize
    if (record.codeChallenge) {
      const pkceValid = verifyPkce(code_verifier, record.codeChallenge, record.codeChallengeMethod);
      if (!pkceValid) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE code_verifier check failed.' });
      }
    }

    // Delete the one-time code immediately
    await codeRef.delete().catch(() => {});

    // Mint access token (30 days) and refresh token (1 year)
    const tokenPayload = {
      uid: record.uid,
      email: record.email || '',
      clientId: record.clientId || client_id || 'claude',
      scope: record.scope || 'finance:read finance:write',
    };

    const accessToken = signAccessToken(tokenPayload, 30 * 24 * 60 * 60); // 30 days
    const refreshToken = 'bt_rt_' + crypto.randomBytes(32).toString('hex');

    // Store refresh token in Firestore
    await db.collection('oauth_refresh_tokens').doc(refreshToken).set({
      token: refreshToken,
      uid: record.uid,
      email: record.email || '',
      clientId: record.clientId || client_id || 'claude',
      createdAt: Date.now(),
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 30 * 24 * 60 * 60,
      refresh_token: refreshToken,
      scope: record.scope || 'finance:read finance:write',
    });
  }

  // ── Grant: refresh_token ──────────────────────────────────────────────────
  if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing refresh_token parameter.' });
    }

    const refDoc = await db.collection('oauth_refresh_tokens').doc(refresh_token).get();
    if (!refDoc.exists) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid refresh token.' });
    }

    const refData = refDoc.data();
    if (Date.now() > (refData.expiresAt || 0)) {
      await db.collection('oauth_refresh_tokens').doc(refresh_token).delete().catch(() => {});
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token expired.' });
    }

    const tokenPayload = {
      uid: refData.uid,
      email: refData.email || '',
      clientId: refData.clientId || 'claude',
      scope: 'finance:read finance:write',
    };

    const newAccessToken = signAccessToken(tokenPayload, 30 * 24 * 60 * 60);

    return res.status(200).json({
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: 30 * 24 * 60 * 60,
      scope: 'finance:read finance:write',
    });
  }

  return res.status(400).json({
    error: 'unsupported_grant_type',
    error_description: 'Supported grant types: authorization_code, refresh_token.',
  });
}
