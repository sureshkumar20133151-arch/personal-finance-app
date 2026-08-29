// Canonical plan config, shared by the payment and household API routes.
// Mirrors the existing client logic in src/context/FinanceContext.jsx:
//   - isPro (full features, no 50-txn limit): starter / monthly / yearly / lifetime / active trial
//   - isSmsUnlocked (SMS auto-scan add-on): sms_pro only
// (No bug here - starter/monthly/yearly already unlock full Pro features on
// the client. Household seat limits below are a new tier scheme layered on
// top for the multi-user feature, not a change to existing plan behavior.)

export const PLAN_AMOUNTS_PAISE = {
  starter: 900,    // ₹9 (temporarily lowered for live-payment testing)
  monthly: 10000,  // ₹100
  yearly: 90000,   // ₹900
};

export const PLAN_NAMES = {
  starter: "Starter Plan",
  monthly: "Pro Monthly Plan",
  yearly: "Pro Yearly Plan",
};

// Household seat limits by subscription value (used by the household API only).
export const SEAT_LIMITS = {
  free: 1,
  trial: 4,
  starter: 4,
  monthly: 4,
  yearly: 4,
  lifetime: 4,
  sms_pro: 4,
};

export function seatLimitFor(subscription) {
  return SEAT_LIMITS[subscription] ?? 1;
}
