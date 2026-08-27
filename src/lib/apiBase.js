import { Capacitor } from '@capacitor/core';

// On the native Android/iOS app, the webview's own origin is a local
// scheme (roughly https://localhost), NOT the deployed Vercel site -
// this app is bundled (capacitor.config webDir: "dist"), not loaded
// live from a server. So a relative fetch('/api/...') silently resolves
// against the wrong origin and never reaches our backend at all.
// On the web version, a relative path already resolves correctly
// (same origin), so this is a no-op there.
const PRODUCTION_ORIGIN = 'https://personal-finance-app-mauve.vercel.app';

export function apiUrl(path) {
  if (Capacitor.isNativePlatform()) {
    return `${PRODUCTION_ORIGIN}${path}`;
  }
  return path;
}
