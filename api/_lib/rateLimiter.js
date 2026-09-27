// ─────────────────────────────────────────────────────────────────────────────
//  In-Memory Sliding Window Rate Limiter
//  Designed for Serverless & MCP Endpoints to prevent quota exhaustion and abuse.
// ─────────────────────────────────────────────────────────────────────────────

class SlidingWindowRateLimiter {
  constructor() {
    // Map of identifier -> array of timestamps (ms)
    this.storage = new Map();
    // Periodically clean up old buckets every 5 minutes to prevent memory leak
    if (typeof setInterval !== 'undefined') {
      const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, timestamps] of this.storage.entries()) {
          const valid = timestamps.filter(t => now - t < 300000);
          if (valid.length === 0) {
            this.storage.delete(key);
          } else {
            this.storage.set(key, valid);
          }
        }
      }, 300000);
      if (cleanupInterval.unref) cleanupInterval.unref();
    }
  }

  /**
   * Check and consume rate limit
   * @param {string} identifier - e.g. "uid:123" or "ip:1.2.3.4"
   * @param {number} maxRequests - allowed requests in window
   * @param {number} windowMs - window size in milliseconds (e.g. 60000 for 1 min)
   * @returns {{ allowed: boolean, remaining: number, resetTimeMs: number, retryAfterSeconds: number, currentCount: number }}
   */
  check(identifier, maxRequests = 60, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;

    let timestamps = this.storage.get(identifier) || [];
    // Keep only timestamps within current window
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= maxRequests) {
      const oldestInWindow = timestamps[0];
      const resetTimeMs = oldestInWindow + windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));

      return {
        allowed: false,
        remaining: 0,
        resetTimeMs,
        retryAfterSeconds,
        currentCount: timestamps.length,
      };
    }

    // Record this request
    timestamps.push(now);
    this.storage.set(identifier, timestamps);

    return {
      allowed: true,
      remaining: maxRequests - timestamps.length,
      resetTimeMs: now + windowMs,
      retryAfterSeconds: 0,
      currentCount: timestamps.length,
    };
  }

  reset(identifier) {
    this.storage.delete(identifier);
  }

  clear() {
    this.storage.clear();
  }
}

// Global singleton instance for hot serverless lambdas
export const globalRateLimiter = new SlidingWindowRateLimiter();

// Tool classification for MCP
export const WRITE_TOOLS = new Set([
  'add_transaction',
  'add_category',
  'edit_category',
  'delete_category',
]);

/**
 * Convenience helper to enforce rate limit on MCP tools
 * Read tools: 60 req/min
 * Write tools: 20 req/min
 */
export function checkMcpRateLimit(targetUid, toolName = null) {
  const isWrite = toolName && WRITE_TOOLS.has(toolName);
  const maxLimit = isWrite ? 20 : 60;
  const windowMs = 60 * 1000; // 1 minute
  const prefix = isWrite ? 'mcp:write' : 'mcp:read';
  const key = `${prefix}:${targetUid || 'anonymous'}`;

  return {
    ...globalRateLimiter.check(key, maxLimit, windowMs),
    isWrite,
    maxLimit,
  };
}
