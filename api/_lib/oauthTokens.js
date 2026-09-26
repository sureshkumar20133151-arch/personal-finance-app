// ─────────────────────────────────────────────────────────────────────────────
//  OAuth 2.0 Token Utility — Zero-dependency HMAC-SHA256 (HS256) JWT Signer
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';

const OAUTH_SECRET = process.env.MCP_OAUTH_SECRET || process.env.MCP_API_KEY || 'budget-tracker-oauth-secret-fallback-key-2026';

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Mint a signed JWT access token for a user
 * @param {Object} payload { uid, email, client_id, scope }
 * @param {number} expiresInSeconds default 30 days (2592000s)
 */
export function signAccessToken(payload, expiresInSeconds = 2592000) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    iss: 'https://personal-finance-app-mauve.vercel.app',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', OAUTH_SECRET)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signatureInput}.${signature}`;
}

/**
 * Verify and decode an access token
 * @param {string} token
 * @returns {Object|null} payload if valid, null otherwise
 */
export function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', OAUTH_SECRET)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const expectedSigBuf = Buffer.from(expectedSignature);
  const actualSigBuf = Buffer.from(signature);
  if (expectedSigBuf.length !== actualSigBuf.length || !crypto.timingSafeEqual(expectedSigBuf, actualSigBuf)) {
    return null; // Invalid signature
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify PKCE S256 Code Challenge
 * code_challenge == BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))
 */
export function verifyPkce(codeVerifier, codeChallenge, codeChallengeMethod = 'S256') {
  if (!codeChallenge) return true; // Optional if client didn't send challenge
  if (!codeVerifier) return false;

  if (codeChallengeMethod === 'plain') {
    return codeVerifier === codeChallenge;
  }

  // S256 (default for modern OAuth 2.0 / RFC 7636)
  const hash = crypto.createHash('sha256').update(codeVerifier, 'ascii').digest();
  const computedChallenge = hash
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return computedChallenge === codeChallenge;
}
