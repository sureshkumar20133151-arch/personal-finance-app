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
  free: 1,       // 1 person (owner only - cannot invite people)
  starter: 2,    // 2 members max (owner + 1 invited person)
  trial: 4,      // 4 members max (Pro trial)
  monthly: 4,    // 4 members max (Pro)
  yearly: 4,     // 4 members max (Pro)
  lifetime: 4,   // 4 members max (Pro)
  sms_pro: 4,    // 4 members max (Pro)
};

export function seatLimitFor(subscription) {
  return SEAT_LIMITS[subscription] ?? 1;
}
