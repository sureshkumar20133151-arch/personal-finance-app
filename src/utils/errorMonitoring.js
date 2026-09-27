// ─────────────────────────────────────────────────────────────────────────────
//  Production Error Monitoring (Sentry Integration & Global Crash Reporter)
// ─────────────────────────────────────────────────────────────────────────────

import * as Sentry from '@sentry/react';

let sentryInitialized = false;

/**
 * Initialize Error Monitoring.
 * If VITE_SENTRY_DSN is provided in env, it will configure Sentry.
 * Even without DSN, it catches unhandled promises & window errors to prevent silent crashes.
 */
export function initErrorMonitoring() {
  const dsn = (import.meta.env?.VITE_SENTRY_DSN || '').trim();

  // Global unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Global Unhandled Rejection]:', event.reason);
    captureException(event.reason, { mechanism: 'unhandledrejection' });
  });

  // Global uncaught error handler
  window.addEventListener('error', (event) => {
    console.error('[Global Uncaught Error]:', event.error || event.message);
    captureException(event.error || new Error(event.message), { mechanism: 'window.onerror' });
  });

  if (!dsn) {
    if (import.meta.env?.DEV) {
      console.info('[ErrorMonitoring] VITE_SENTRY_DSN not set. Running in local diagnostic mode.');
    }
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env?.MODE || 'production',
      release: `budget-tracker@${import.meta.env?.VITE_APP_VERSION || '1.0.7'}`,
      tracesSampleRate: 0.1, // 10% performance tracing
    });
    sentryInitialized = true;
    console.info('[ErrorMonitoring] Sentry initialized successfully.');
  } catch (err) {
    console.warn('[ErrorMonitoring] Failed to initialize Sentry:', err.message);
  }
}

/**
 * Report an exception to Sentry and developer logs
 * @param {Error|any} error
 * @param {Record<string, any>} context
 */
export function captureException(error, context = {}) {
  try {
    if (sentryInitialized) {
      Sentry.captureException(error, { extra: context });
    }
  } catch (e) {
    console.warn('[ErrorMonitoring] captureException failure:', e);
  }
}

/**
 * Attach user ID to error reports
 */
export function setErrorUser(user) {
  try {
    if (sentryInitialized) {
      if (user?.uid) {
        Sentry.setUser({ id: user.uid });
      } else {
        Sentry.setUser(null);
      }
    }
  } catch {
    // Ignore error setting user
  }
}
