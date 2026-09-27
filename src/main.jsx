import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initErrorMonitoring } from './utils/errorMonitoring.js'

// Initialize production error monitoring (Sentry / global unhandled handlers)
initErrorMonitoring();

// Ask the browser/WebView to make our storage (IndexedDB, where Firebase Auth
// keeps the signed-in session) persistent rather than "best-effort". Without
// this, Android's WebView can silently evict it under storage pressure,
// which shows up as users randomly getting signed out between app launches.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
