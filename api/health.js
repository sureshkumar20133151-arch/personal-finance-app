// ─────────────────────────────────────────────────────────────────────────────
//  Health & Uptime Monitoring Endpoint
//  Endpoint: GET /api/health
//  Compatible with: BetterStack, UptimeRobot, Pingdom, Checkly
// ─────────────────────────────────────────────────────────────────────────────

import { adminDb } from './_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const startTime = Date.now();
  let dbStatus = 'unconfigured';

  try {
    const db = await adminDb();
    if (db) {
      // Lightweight read to verify Firestore connection
      await db.collection('users').limit(1).get();
      dbStatus = 'healthy';
    }
  } catch (err) {
    dbStatus = `degraded (${err.message})`;
  }

  const responseTimeMs = Date.now() - startTime;
  const isHealthy = dbStatus === 'healthy' || dbStatus === 'unconfigured';

  const statusPayload = {
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'Budget Tracker SaaS API',
    version: '1.0.7',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    latencyMs: responseTimeMs,
    dependencies: {
      firestore: dbStatus,
    },
    environment: process.env.NODE_ENV || 'production',
  };

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.status(isHealthy ? 200 : 503).json(statusPayload);
}
