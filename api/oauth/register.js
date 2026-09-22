// ─────────────────────────────────────────────────────────────────────────────
//  OAuth 2.0 Dynamic Client Registration (RFC 7591)
//  Allows Claude to register its client automatically without manual user input
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'invalid_request',
      error_description: 'Only POST requests are supported for client registration.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const clientId = 'claude_' + crypto.randomBytes(12).toString('hex');

    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      client_id: clientId,
      client_name: body.client_name || 'Claude Connector',
      redirect_uris: body.redirect_uris || ['https://claude.ai/api/auth/callback'],
      grant_types: body.grant_types || ['authorization_code', 'refresh_token'],
      response_types: body.response_types || ['code'],
      token_endpoint_auth_method: 'none',
      token_endpoint_auth_methods_supported: ['none'],
    });
  } catch (err) {
    console.error('Error in DCR registration:', err);
    return res.status(400).json({
      error: 'invalid_client_metadata',
      error_description: 'Could not process client registration request.'
    });
  }
}
