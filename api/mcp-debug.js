// Temporary diagnostic endpoint — identifies which Firebase project the Admin SDK is using
// GET https://personal-finance-app-mauve.vercel.app/api/mcp-debug?key=<MCP_API_KEY>

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const key = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim()
              || (req.query?.key || '').trim();
  if (!process.env.MCP_API_KEY || key !== process.env.MCP_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const mcpProjectId   = process.env.MCP_FIREBASE_PROJECT_ID;
  const mcpClientEmail = process.env.MCP_FIREBASE_CLIENT_EMAIL;
  const mcpPrivateKey  = process.env.MCP_FIREBASE_PRIVATE_KEY;

  const legacyProjectId   = process.env.FIREBASE_PROJECT_ID;
  const legacyClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const legacyPrivateKey  = process.env.FIREBASE_PRIVATE_KEY;

  const effectiveProjectId   = mcpProjectId   || legacyProjectId   || '(not set)';
  const effectiveClientEmail = mcpClientEmail || legacyClientEmail || '(not set)';
  const effectiveKey         = mcpPrivateKey  || legacyPrivateKey  || '';
  const DEFAULT_SURESH_UID = 'mlbLQkDo0Ef95hns8p81TkQdUK83';
  const DEFAULT_ROSIE_UID  = 'do139V31SkRXMSpkLIW1AroA9ZO2';

  const queryUid = (req.query?.uid || '').trim();
  const userParam = (req.query?.user || '').trim().toLowerCase();
  let mcpUid = queryUid;
  if (!mcpUid) {
    if (userParam === 'rosie') mcpUid = process.env.ROSIE_USER_UID || DEFAULT_ROSIE_UID;
    else if (userParam === 'suresh' || userParam === 'default') mcpUid = process.env.SURESH_USER_UID || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
    else mcpUid = process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  }
  const expectedProjectId    = 'listing-generator-31b39';

  let firestoreStatus = 'Not tested';
  let docExists = null;
  let sampleTxCount = null;

  if (!effectiveKey || effectiveProjectId === '(not set)') {
    firestoreStatus = 'Missing credentials — set MCP_FIREBASE_PROJECT_ID, MCP_FIREBASE_CLIENT_EMAIL, MCP_FIREBASE_PRIVATE_KEY in Vercel';
  } else {
    try {
      const { initializeApp, getApps, cert } = await import('firebase-admin/app');
      const { getFirestore } = await import('firebase-admin/firestore');

      const appName = 'mcp-debug-app';
      const existing = getApps().find(a => a.name === appName);
      const privateKey = effectiveKey.includes('\\n') ? effectiveKey.replace(/\\n/g, '\n') : effectiveKey;
      const app = existing || initializeApp({
        credential: cert({
          projectId: effectiveProjectId,
          clientEmail: effectiveClientEmail,
          privateKey
        })
      }, appName);

      const db = getFirestore(app);
      const snap = await db.collection('users').doc(mcpUid).get();
      docExists = snap.exists;
      if (snap.exists) {
        const data = snap.data();
        sampleTxCount = (data.transactions || []).length;
        const mcpTxs = (data.transactions || []).filter(t => t.source === 'mcp');
        firestoreStatus = `OK — user document found! Total transactions: ${sampleTxCount}, MCP added: ${mcpTxs.length}`;
      } else {
        firestoreStatus = `Connected to Firestore successfully, but user doc NOT FOUND for UID: ${mcpUid}. (Check UID in Account page)`;
      }
    } catch (e) {
      firestoreStatus = `Error connecting to Firestore: ${e.message}`;
    }
  }

  return res.status(200).json({
    diagnosis: {
      active_project_id: effectiveProjectId,
      expected_project_id: expectedProjectId,
      project_is_correct: effectiveProjectId === expectedProjectId,
      active_client_email: effectiveClientEmail.length > 10 ? effectiveClientEmail.substring(0, 30) + '...' : effectiveClientEmail,
      used_mcp_specific_vars: Boolean(mcpProjectId),
      mcp_user_uid: mcpUid,
    },
    firestore_test: firestoreStatus,
    fix_needed: effectiveProjectId !== expectedProjectId
      ? `⚠️ WRONG PROJECT! Using "${effectiveProjectId}" instead of "${expectedProjectId}". Update MCP_FIREBASE_* variables in Vercel.`
      : (!docExists ? `⚠️ Project is correct (${effectiveProjectId}), but UID "${mcpUid}" not found. Copy your active UID from app Account page and set as MCP_USER_UID in Vercel.` : `✅ Everything is properly configured and connected!`),
  });
}
