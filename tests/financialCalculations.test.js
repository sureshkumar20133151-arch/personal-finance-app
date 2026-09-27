import { describe, it, expect } from 'vitest';
import { PLAN_AMOUNTS_PAISE, SEAT_LIMITS, seatLimitFor } from '../api/_lib/plans.js';

describe('Financial Plans and Seat Limits', () => {
  it('has consistent plan amounts in paise', () => {
    expect(PLAN_AMOUNTS_PAISE.starter).toBe(900); // ₹9
    expect(PLAN_AMOUNTS_PAISE.monthly).toBe(10000); // ₹100
    expect(PLAN_AMOUNTS_PAISE.yearly).toBe(90000); // ₹900
  });

  it('correctly maps seat limits for household collaboration', () => {
    expect(seatLimitFor('free')).toBe(1);
    expect(seatLimitFor('starter')).toBe(2);
    expect(seatLimitFor('monthly')).toBe(4);
    expect(seatLimitFor('yearly')).toBe(4);
    expect(seatLimitFor('lifetime')).toBe(4);
    expect(seatLimitFor('unknown_tier')).toBe(1);
  });

  it('calculates safe daily spend correctly', () => {
    function calculateSafeToSpendPerDay(balance, daysRemainingInMonth) {
      if (balance <= 0 || daysRemainingInMonth <= 0) return 0;
      return Math.floor(balance / daysRemainingInMonth);
    }

    expect(calculateSafeToSpendPerDay(30000, 15)).toBe(2000);
    expect(calculateSafeToSpendPerDay(1000, 30)).toBe(33);
    expect(calculateSafeToSpendPerDay(-500, 10)).toBe(0);
    expect(calculateSafeToSpendPerDay(5000, 0)).toBe(0);
  });
});
