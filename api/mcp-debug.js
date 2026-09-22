// Temporary diagnostic endpoint — identifies which Firebase project the Admin SDK is using
// GET https://personal-finance-app-mauve.vercel.app/api/mcp-debug?key=<MCP_API_KEY>

import { adminDb } from './_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const key = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim()
              || (req.query?.key || '').trim();
  if (!process.env.MCP_API_KEY || key !== process.env.MCP_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const projectId    = process.env.FIREBASE_PROJECT_ID    || '(not set)';
  const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL  || '(not set)';
  const mcpProjectId = process.env.MCP_FIREBASE_PROJECT_ID || '(not set)';
  const mcpUid       = process.env.MCP_USER_UID            || '(not set)';
  const expectedProjectId = 'listing-generator-31b39';

  let firestoreStatus = 'Not tested';
  let docExists = null;
  let sampleTxCount = null;

  try {
    const db = await adminDb();
    if (!db) {
      firestoreStatus = 'adminDb() returned null — missing FIREBASE_* credentials in Vercel';
    } else {
      // Try to read the user document
      const snap = await db.collection('users').doc(mcpUid).get();
      docExists = snap.exists;
      if (snap.exists) {
        const data = snap.data();
        sampleTxCount = (data.transactions || []).length;
        // Look for MCP-added transactions
        const mcpTxs = (data.transactions || []).filter(t => t.source === 'mcp');
        firestoreStatus = `OK — doc exists, ${sampleTxCount} total transactions, ${mcpTxs.length} added via MCP`;
      } else {
        firestoreStatus = `User doc NOT FOUND for UID: ${mcpUid}`;
      }
    }
  } catch (e) {
    firestoreStatus = `Error: ${e.message}`;
  }

  return res.status(200).json({
    diagnosis: {
      active_project_id: projectId,
      expected_project_id: expectedProjectId,
      project_is_correct: projectId === expectedProjectId,
      firebase_client_email: clientEmail.substring(0, 30) + '...',
      mcp_specific_project: mcpProjectId,
      mcp_user_uid: mcpUid,
    },
    firestore_test: firestoreStatus,
    fix_needed: projectId !== expectedProjectId
      ? `⚠️ WRONG PROJECT! Admin SDK is using "${projectId}" but app data lives in "${expectedProjectId}". Add service account from listing-generator-31b39 to Vercel as MCP_FIREBASE_PROJECT_ID, MCP_FIREBASE_CLIENT_EMAIL, MCP_FIREBASE_PRIVATE_KEY.`
      : `✅ Correct project. If doc is missing, MCP_USER_UID may be wrong.`,
  });
}
