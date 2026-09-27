import { describe, it, expect, beforeEach } from 'vitest';
import { globalRateLimiter, checkMcpRateLimit, WRITE_TOOLS } from '../api/_lib/rateLimiter.js';

describe('SlidingWindowRateLimiter', () => {
  beforeEach(() => {
    globalRateLimiter.clear();
  });

  it('allows requests within limit', () => {
    const id = 'test-client-1';
    for (let i = 0; i < 5; i++) {
      const res = globalRateLimiter.check(id, 5, 1000);
      expect(res.allowed).toBe(true);
      expect(res.currentCount).toBe(i + 1);
    }
  });

  it('blocks requests exceeding limit and provides retryAfterSeconds', () => {
    const id = 'test-client-2';
    // Exhaust limit of 3
    for (let i = 0; i < 3; i++) {
      globalRateLimiter.check(id, 3, 5000);
    }

    const blocked = globalRateLimiter.check(id, 3, 5000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('correctly classifies MCP tools into read vs write limits', () => {
    expect(WRITE_TOOLS.has('add_transaction')).toBe(true);
    expect(WRITE_TOOLS.has('delete_category')).toBe(true);
    expect(WRITE_TOOLS.has('get_balances')).toBe(false);
    expect(WRITE_TOOLS.has('get_profile')).toBe(false);

    const writeCheck = checkMcpRateLimit('user-1', 'add_transaction');
    expect(writeCheck.isWrite).toBe(true);
    expect(writeCheck.maxLimit).toBe(20);

    const readCheck = checkMcpRateLimit('user-1', 'get_balances');
    expect(readCheck.isWrite).toBe(false);
    expect(readCheck.maxLimit).toBe(60);
  });
});
