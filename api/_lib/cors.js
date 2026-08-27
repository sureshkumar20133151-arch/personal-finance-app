// The native Android/iOS app's webview origin differs from this site's
// own origin (see src/lib/apiBase.js for why it must call the absolute
// Vercel URL), so these become cross-origin requests from the browser's
// perspective. Vercel doesn't add CORS headers by default, so without
// this, requests from the native app would be blocked even though they
// reach the server fine. Safe to allow broadly here since every route
// still requires a valid Firebase ID token - CORS only controls who can
// read the response, not who's authorized.
export function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true; // caller should return immediately
  }
  return false;
}
