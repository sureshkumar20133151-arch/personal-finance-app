// ─────────────────────────────────────────────────────────────────────────────
//  OAuth 2.0 Authorization Server Metadata (RFC 8414 / OpenID Discovery)
//  Discovered by Claude at /.well-known/oauth-authorization-server
// ─────────────────────────────────────────────────────────────────────────────

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'personal-finance-app-mauve.vercel.app';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${host}`;

  res.status(200).json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: null,
    scopes_supported: ['finance:read', 'finance:write'],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256', 'plain'],
    service_documentation: `${baseUrl}/terms`,
    client_name: 'Budget Tracker Pro',
    service_name: 'Budget Tracker Pro',
    app_name: 'Budget Tracker Pro',
    logo_uri: `${baseUrl}/app-icon-512.png`,
    icon_url: `${baseUrl}/app-icon-512.png`,
    op_policy_uri: `${baseUrl}/privacy`,
    op_tos_uri: `${baseUrl}/terms`,
  });
}
