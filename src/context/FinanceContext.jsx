// ─────────────────────────────────────────────────────────────────────────────
//  FinanceContext.jsx  —  DROP-IN REPLACEMENT for your existing context
//
//  Changes from your original:
//   ✅ Auto-scans SMS + notifications on startup
//   ✅ Re-scans when app comes to foreground
//   ✅ Bank balance calculated from initialBankBalance + all transactions
//   ✅ bankBalance exposed in context (use it on Dashboard)
//   ✅ cashBalance exposed in context
//   ✅ totalBalance = bankBalance + cashBalance
//   ✅ addTransactions() exposed for manual SMS scan modal
//
//  Everything else (categories, loans, recurring, Firebase sync) unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { registerPlugin }    from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { doc, setDoc, onSnapshot, getDoc, deleteDoc } from "firebase/firestore";
import { db }                from "../lib/firebase";          // ← your firebase.js path
import { useAuth }           from "./AuthContext";       // ← your auth context path
import { autoScanTransactions, autoCategory, getAvailableBalance, parseSms } from "./autoScanSms";
import { v4 as uuidv4 }     from "uuid";
import { apiUrl } from "../lib/apiBase";

const App = registerPlugin("App");

// ─── Default data ─────────────────────────────────────────────────────────────
export const SUGGESTED_CATEGORIES = {
  "Business": [
    { name: "Business Revenue", type: "income", color: "#10b981", icon: "Briefcase", budget: 0 },
    { name: "Investments", type: "income", color: "#8b5cf6", icon: "TrendingUp", budget: 0 },
    { name: "Consulting", type: "income", color: "#06b6d4", icon: "UserCheck", budget: 0 },
    { name: "Office Rent", type: "expense", color: "#6366f1", icon: "Building", budget: 10000 },
    { name: "Marketing", type: "expense", color: "#ec4899", icon: "Megaphone", budget: 5000 },
    { name: "Travel", type: "expense", color: "#ef4444", icon: "Plane", budget: 3000 },
    { name: "Food", type: "expense", color: "#f59e0b", icon: "Utensils", budget: 3000 },
    { name: "Supplies", type: "expense", color: "#8b5cf6", icon: "Package", budget: 2000 },
    { name: "Utilities", type: "expense", color: "#3b82f6", icon: "Zap", budget: 2000 },
    { name: "Emergency Fund", type: "savings", color: "#06b6d4", icon: "ShieldCheck", budget: 0 },
    { name: "Credit Card", type: "debt", color: "#f97316", icon: "CreditCard", budget: 0 },
  ],
  "Working Professional": [
    { name: "Salary", type: "income", color: "#10b981", icon: "Wallet", budget: 0 },
    { name: "Bonus", type: "income", color: "#3b82f6", icon: "Gift", budget: 0 },
    { name: "Side Income", type: "income", color: "#8b5cf6", icon: "Laptop", budget: 0 },
    { name: "Food", type: "expense", color: "#f59e0b", icon: "Utensils", budget: 5000 },
    { name: "Transport", type: "expense", color: "#ef4444", icon: "Car", budget: 2000 },
    { name: "Rent/EMI", type: "expense", color: "#6366f1", icon: "Home", budget: 15000 },
    { name: "Utilities", type: "expense", color: "#3b82f6", icon: "Zap", budget: 2000 },
    { name: "Entertainment", type: "expense", color: "#14b8a6", icon: "Clapperboard", budget: 2000 },
    { name: "Clothes", type: "expense", color: "#ec4899", icon: "ShoppingBag", budget: 2000 },
    { name: "Coffee", type: "expense", color: "#8b5cf6", icon: "Coffee", budget: 1000 },
    { name: "Emergency Fund", type: "savings", color: "#06b6d4", icon: "ShieldCheck", budget: 0 },
    { name: "Credit Card", type: "debt", color: "#f97316", icon: "CreditCard", budget: 0 },
  ],
  "Student": [
    { name: "Pocket Money", type: "income", color: "#f59e0b", icon: "Coins", budget: 0 },
    { name: "Part-time Job", type: "income", color: "#3b82f6", icon: "Clock", budget: 0 },
    { name: "Scholarship", type: "income", color: "#10b981", icon: "GraduationCap", budget: 0 },
    { name: "Food", type: "expense", color: "#f59e0b", icon: "Utensils", budget: 3000 },
    { name: "Transport", type: "expense", color: "#ef4444", icon: "Car", budget: 1000 },
    { name: "Books/Stationery", type: "expense", color: "#8b5cf6", icon: "BookOpen", budget: 1500 },
    { name: "Tuition", type: "expense", color: "#3b82f6", icon: "GraduationCap", budget: 5000 },
    { name: "Entertainment", type: "expense", color: "#14b8a6", icon: "Clapperboard", budget: 1000 },
    { name: "Coffee", type: "expense", color: "#8b5cf6", icon: "Coffee", budget: 500 },
    { name: "Emergency Fund", type: "savings", color: "#06b6d4", icon: "ShieldCheck", budget: 0 },
  ],
  "Home Maker/Housewife": [
    { name: "Household Budget", type: "income", color: "#10b981", icon: "Home", budget: 0 },
    { name: "Savings Interest", type: "income", color: "#06b6d4", icon: "Percent", budget: 0 },
    { name: "Groceries", type: "expense", color: "#10b981", icon: "ShoppingBasket", budget: 8000 },
    { name: "Utilities", type: "expense", color: "#6366f1", icon: "Zap", budget: 3000 },
    { name: "Kids Education", type: "expense", color: "#3b82f6", icon: "GraduationCap", budget: 5000 },
    { name: "Medical", type: "expense", color: "#ef4444", icon: "HeartPulse", budget: 2000 },
    { name: "Household Items", type: "expense", color: "#f59e0b", icon: "Home", budget: 3000 },
    { name: "Beauty", type: "expense", color: "#f472b6", icon: "Sparkles", budget: 1500 },
    { name: "Emergency Fund", type: "savings", color: "#06b6d4", icon: "ShieldCheck", budget: 0 },
    { name: "Credit Card", type: "debt", color: "#f97316", icon: "CreditCard", budget: 0 },
  ]
};

const DEFAULT_CATEGORIES = [
  { id: "1",  name: "Salary",         type: "income",  color: "#10b981", icon: "Wallet",      budget: 0   },
  { id: "2",  name: "Freelance",      type: "income",  color: "#3b82f6", icon: "Laptop",      budget: 0   },
  { id: "3",  name: "Food",           type: "expense", color: "#f59e0b", icon: "Utensils",    budget: 500 },
  { id: "4",  name: "Transport",      type: "expense", color: "#ef4444", icon: "Car",         budget: 200 },
  { id: "5",  name: "Utilities",      type: "expense", color: "#6366f1", icon: "Zap",         budget: 150 },
  { id: "6",  name: "Emergency Fund", type: "savings", color: "#06b6d4", icon: "ShieldCheck", budget: 0   },
  { id: "7",  name: "Credit Card",    type: "debt",    color: "#f97316", icon: "CreditCard",  budget: 0   },
  { id: "8",  name: "Clothes",        type: "expense", color: "#ec4899", icon: "ShoppingBag", budget: 100 },
  { id: "9",  name: "Coffee",         type: "expense", color: "#8b5cf6", icon: "Coffee",      budget: 50  },
  { id: "10", name: "Beauty",         type: "expense", color: "#f472b6", icon: "Sparkles",    budget: 0   },
  { id: "11", name: "Entertainment",  type: "expense", color: "#14b8a6", icon: "Clapperboard",budget: 100 },
];

const DEFAULT_STATE = {
  categories:         DEFAULT_CATEGORIES,
  transactions:       [],
  currency:           { code: "INR", symbol: "₹", locale: "en-IN", name: "Indian Rupee" },
  theme:              { mode: "dark", accent: "blue" },
  subscription:       "free",
  trialEndDate:       null,
  couponsRedeemed:    [],
  profile: {
    firstName: "",
    lastName: "",
    age: null,
    place: "",
    mobile: "",
    profession: "",
    profileComplete: false,
    categoriesSelected: false,
  },
  recurring:          [],
  loans:              [],
  monthlyBudget:      50000,
  lastProcessedMonth: "",
  salaryDate:         1,
  initialBankBalances: {},
  initialCashBalance: 0,
  cashSeedDate: null,
  accountingStartDate: null,
};

const STORAGE_KEY = "fintrack_data";
const FREE_PLAN_MONTHLY_TX_LIMIT = 50;

// Fields that live on the shared households/{id} document once a user
// belongs to a household, instead of their personal users/{uid} document.
// Everything else (profile, subscription, balances, privacy toggle) stays
// personal - see the "Household" feature notes near saveImmediate below.
const HOUSEHOLD_SHARED_FIELDS = [
  "transactions", "categories", "recurring", "loans",
  "monthlyBudget", "salaryDate", "accountingStartDate", "lastProcessedMonth",
];

// ─── Context ──────────────────────────────────────────────────────────────────
// ─── Pure balance-calculation helpers (module scope) ───────────────────────
// Extracted so the exact same precise, SMS-anchored algorithm can run once
// for "my" transactions (as before) and again per OTHER household member -
// each member's own bank SMS balance data travels with their transactions
// (which are shared once in a household), so there's no need to fall back
// to an approximation for anyone.
function computeBankAccountBalancesFor(allTx, initialBankBalances, accountingStartDate) {
  const map = {};

  if (initialBankBalances) {
    Object.entries(initialBankBalances).forEach(([key, data]) => {
      const [bankName, accountEnding] = key.split('_');
      map[key] = { bankName, accountEnding, balance: parseFloat(data.amount) || 0, transactionCount: 0 };
    });
  }

  allTx.forEach(t => {
    const isUPI = t.bankName === 'GPay/UPI' || t.bankName === 'PhonePe';
    if (isUPI) return;
    if (t.bankName && t.accountEnding) {
      const key = `${t.bankName}_${t.accountEnding}`;
      if (!map[key]) map[key] = { bankName: t.bankName, accountEnding: t.accountEnding, balance: 0, transactionCount: 0 };
      const isVisible = !accountingStartDate || new Date(t.date) >= new Date(accountingStartDate);
      if (isVisible) map[key].transactionCount++;
    }
  });

  Object.keys(map).forEach(key => {
    const accountTxs = allTx.filter(t => `${t.bankName}_${t.accountEnding}` === key);
    const txsWithIndex = accountTxs.map((t, i) => ({ ...t, _originalIdx: i }));

    const withBalance = txsWithIndex
      .filter(t => t.availableBalance != null)
      .sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return b._originalIdx - a._originalIdx;
      });

    const seedData = initialBankBalances?.[key];
    let seedDate = seedData?.date ? new Date(seedData.date) : null;

    const hasManualAmount = seedData && seedData.amount !== undefined && seedData.amount !== '';
    if (accountingStartDate && hasManualAmount) {
      const startD = new Date(accountingStartDate);
      if (!seedDate || seedDate < startD) seedDate = startD;
    }

    if (withBalance.length > 0) {
      const smsAnchor = withBalance[0];
      let computedBalance;
      let anchorDate;
      let anchorIdx = -1;

      if (seedDate && seedDate > new Date(smsAnchor.date)) {
        computedBalance = parseFloat(seedData.amount) || 0;
        anchorDate = seedDate;
      } else {
        computedBalance = smsAnchor.availableBalance;
        anchorDate = new Date(smsAnchor.date);
        anchorIdx = smsAnchor._originalIdx;
      }

      txsWithIndex.forEach(t => {
        const tDate = new Date(t.date);
        const isStrictlyNewer = tDate > anchorDate;
        const isSameTimeButNewer = (tDate.getTime() === anchorDate.getTime()) && (t._originalIdx > anchorIdx);

        if (isStrictlyNewer || isSameTimeButNewer) {
          if (t.availableBalance != null) {
            computedBalance = t.availableBalance;
          } else {
            if (t.type === "income") computedBalance += t.amount;
            else if (t.type === "expense" || t.type === "debt") computedBalance -= t.amount;
          }
        }
      });
      map[key].balance = computedBalance;
    } else {
      let computedBalance = seedData ? (parseFloat(seedData.amount) || 0) : 0;
      const effectiveLimitDate = accountingStartDate ? new Date(accountingStartDate) : null;

      accountTxs.forEach(t => {
        if (seedDate && new Date(t.date) < seedDate) return;
        if (effectiveLimitDate && new Date(t.date) < effectiveLimitDate) return;
        if (t.type === "income") computedBalance += t.amount;
        else if (t.type === "expense" || t.type === "debt") computedBalance -= t.amount;
      });
      map[key].balance = computedBalance;
    }
  });
  return Object.values(map);
}

function computeCashBalanceFor(allTx, initialCashBalance, cashSeedDate, accountingStartDate) {
  const startLimit = accountingStartDate ? new Date(accountingStartDate) : null;
  const seedLimit = cashSeedDate ? new Date(cashSeedDate) : null;

  let finalSeedDate = seedLimit;
  if (startLimit) {
    if (!finalSeedDate || finalSeedDate < startLimit) finalSeedDate = startLimit;
  }

  const validTx = finalSeedDate ? allTx.filter(t => new Date(t.date) >= finalSeedDate) : allTx;

  const isAtmWithdrawal = (t) => {
    if (t.type !== "expense") return false;
    const desc = (t.description || "").toLowerCase();
    if (desc.includes("atm service") || desc.includes("amc") || desc.includes("charges") || desc.includes("fee")) {
      return false;
    }
    return (
      desc.includes("atm wdl") ||
      desc.includes("cash withdrawal") ||
      desc.includes("atm cash") ||
      desc.includes("cash wdl") ||
      desc.includes("atm withdrawal") ||
      /self-\d+/i.test(desc)
    );
  };

  const cashIn  = validTx.filter(t => t.type === "income" && t.paymentMode === "cash");
  const atmOut  = validTx.filter(isAtmWithdrawal);
  const cashOut = validTx.filter(t =>
    (t.type === "expense" || t.type === "debt") &&
    t.paymentMode === "cash" &&
    !isAtmWithdrawal(t)
  );
  const inflow  = cashIn.reduce((s, t) => s + t.amount, 0) + atmOut.reduce((s, t) => s + t.amount, 0);
  const outflow = cashOut.reduce((s, t) => s + t.amount, 0);
  return (initialCashBalance || 0) + inflow - outflow;
}

const FinanceContext = createContext(undefined);

export function FinanceProvider({ children }) {
  const { currentUser, logout } = useAuth();

  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    try { return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : DEFAULT_STATE; }
    catch { return DEFAULT_STATE; }
  });

  const [loading, setLoading] = useState(true);

  // ─── Persist ──────────────────────────────────────────────────────────────
  const persistDebounce = useRef(null);

  const sanitizeForFirestore = (obj) => {
    if (!obj) return obj;
    return JSON.parse(JSON.stringify(obj, (key, value) => (value === undefined ? null : value)));
  };

  // ─── Household-aware save ───────────────────────────────────────────────
  // When a user belongs to a household, HOUSEHOLD_SHARED_FIELDS get written
  // to households/{householdId} (visible to every member) and everything
  // else still goes to users/{uid} (personal - profile, subscription,
  // balances, privacy toggle). Non-household users are completely
  // unaffected: householdId is undefined, so this always takes the
  // original single-doc path.
  const splitForHousehold = (data) => {
    const householdId = data.householdId;
    if (!householdId) return { householdId: null, shared: null, personal: data };
    const shared = {};
    const personal = { ...data };
    HOUSEHOLD_SHARED_FIELDS.forEach((f) => {
      if (f in data) {
        shared[f] = data[f];
        delete personal[f];
      }
    });
    return { householdId, shared, personal };
  };

  const saveImmediate = useCallback((data) => {
    setState(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // All logged-in users get cloud sync (not just Pro)
    if (currentUser && !currentUser.isAnonymous) {
      const { householdId, shared, personal } = splitForHousehold(data);
      // Return the write promise so callers that care about success/failure
      // (e.g. saveProfile) can await it instead of this being silently
      // fire-and-forget. Existing callers that don't await it are unaffected.
      const writes = [
        setDoc(doc(db, "users", currentUser.uid), sanitizeForFirestore(personal), { merge: true }),
      ];
      if (householdId) {
        writes.push(setDoc(doc(db, "households", householdId), sanitizeForFirestore(shared), { merge: true }));
      }
      return Promise.all(writes).catch(e => { console.error("Firebase save failed", e); throw e; });
    }
    return Promise.resolve();
  }, [currentUser]);

  const saveDebounced = useCallback((data) => {
    setState(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    // All logged-in users get cloud sync (not just Pro)
    if (currentUser && !currentUser.isAnonymous) {
      if (persistDebounce.current) clearTimeout(persistDebounce.current);
      persistDebounce.current = setTimeout(() => {
        const { householdId, shared, personal } = splitForHousehold(data);
        setDoc(doc(db, "users", currentUser.uid), sanitizeForFirestore(personal), { merge: true })
          .catch(e => console.error("Firebase save failed", e));
        if (householdId) {
          setDoc(doc(db, "households", householdId), sanitizeForFirestore(shared), { merge: true })
            .catch(e => console.error("Firebase household save failed", e));
        }
      }, 800);
    }
  }, [currentUser]);

  // ─── Load from Firebase / localStorage ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const boot = async (loadedState) => {
      if (!cancelled) {
        // --- TRIAL CONFIGURATION & AUTO-DOWNGRADE ---
        let stateChanged = false;
        if ((loadedState.subscription === 'free' || loadedState.subscription === 'trial') && !loadedState.trialEndDate) {
          loadedState.subscription = 'trial';
          loadedState.trialEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90-day trial
          stateChanged = true;
        } else if (loadedState.subscription === 'trial' && loadedState.trialEndDate) {
          const remainingMs = new Date(loadedState.trialEndDate) - new Date();
          if (remainingMs <= 0) {
            loadedState.subscription = 'free';
            stateChanged = true;
          }
        }

        // --- MIGRATION: Grandfather old accounts that predate the profile-completion
        // feature. If `profile` was never saved to Firestore at all (not just empty),
        // this is a pre-existing real user — mark them complete so they're never asked.
        // Genuinely new signups always get a `profile` object written at signup time,
        // so this only ever fires once, for old accounts, the first time they load.
        if (loadedState.profile === undefined) {
          loadedState.profile = { ...DEFAULT_STATE.profile, profileComplete: true, categoriesSelected: true };
          stateChanged = true;
        } else if (loadedState.profile && loadedState.profile.categoriesSelected === undefined) {
          loadedState.profile.categoriesSelected = true;
          stateChanged = true;
        }

        if (stateChanged) {
          saveImmediate(loadedState);
        }

        const sub = loadedState.subscription;
        // isProUser here only controls SMS scanner gating (the only locked Pro feature)
        const isProUser = sub === 'sms_pro';

        // --- MIGRATION: Data Healing ---
        if (loadedState.transactions) {
          let migrated = false;
          loadedState.transactions = loadedState.transactions.map(t => {
            let updatedT = { ...t };
            
            // Fix Canara Bank 128 -> 9128
            if (updatedT.bankName === 'Canara Bank' && updatedT.accountEnding === '128') {
              migrated = true;
              updatedT.accountEnding = '9128';
            }
            
            // Re-parse SMS transactions to fix missing availableBalance and wrong amounts from old bugs
            if (updatedT.source === 'sms' && updatedT.rawSms) {
                const reParsed = parseSms(updatedT.rawSms, Date.parse(updatedT.date));
                if (reParsed) {
                    if (updatedT.availableBalance !== reParsed.availableBalance || updatedT.amount !== reParsed.amount) {
                        migrated = true;
                        updatedT.availableBalance = reParsed.availableBalance;
                        updatedT.amount = reParsed.amount;
                    }
                }
            }
            return updatedT;
          });

          // --- DEDUPLICATION DATA HEALING ---
          const originalLength = loadedState.transactions.length;
          const uniqueTxs = [];
          const seenUpi = new Set();
          const seenRawSms = new Set();
          const seenManualKeys = new Set();

          const getUpiRefLocal = (tx) => {
            const searchStr = `${tx.description || ''} ${tx.rawSms || ''} ${tx.originalRow || ''}`;
            const match = searchStr.match(/\b\d{12}\b/);
            return match ? match[0] : null;
          };

          loadedState.transactions.forEach(t => {
            const upi = getUpiRefLocal(t);
            if (upi) {
              const upiKey = `${upi}_${Math.abs(t.amount)}`;
              if (seenUpi.has(upiKey)) return; // skip duplicate
              seenUpi.add(upiKey);
            }
            if (t.rawSms) {
              const trimmedSms = t.rawSms.trim();
              if (seenRawSms.has(trimmedSms)) return; // skip duplicate
              seenRawSms.add(trimmedSms);
            }
            if (!upi && !t.rawSms) {
              const key = `${t.date}_${t.amount}_${t.description}_${t.type}_${t.bankName}_${t.accountEnding}`;
              if (seenManualKeys.has(key)) return; // skip duplicate
              seenManualKeys.add(key);
            }
            uniqueTxs.push(t);
          });

          if (uniqueTxs.length < originalLength) {
            loadedState.transactions = uniqueTxs;
            console.log(`[FinanceContext] Auto-cleaned ${originalLength - uniqueTxs.length} duplicates during boot`);
            migrated = true;
          }

          if (migrated) {
            console.log("[FinanceContext] Applied data migrations & deduplication");
            saveImmediate(loadedState);
          }
        }
        // --------------------------------------------------------

        // Request permissions for notifications
        if (window.Capacitor?.isNativePlatform()) {
          try {
            await LocalNotifications.requestPermissions();
            await LocalNotifications.createChannel({
              id: 'sms-sync',
              name: 'SMS & Notification Sync',
              description: 'Alerts when the app reads financial SMS alerts.',
              importance: 4,
              visibility: 1,
              vibration: true
            });
          } catch (e) {
            console.error("LocalNotifications setup error", e);
          }
        }

        // Run auto SMS scan immediately after load (gated for PRO/TRIAL users)
        let newTxs = [];
        let totalScanned = 0;
        let needsSetup = false;

        if (isProUser) {
          const res = await autoScanTransactions(loadedState.transactions || []);
          newTxs = res.newTransactions;
          totalScanned = res.totalScanned;
          needsSetup = res.needsSetup;
        }

        if (isProUser && needsSetup && !cancelled) {
          // Notify app to show SmsSetupGuide modal
          window.dispatchEvent(new CustomEvent("sms_needs_setup"));
        }

        if (isProUser && window.Capacitor?.isNativePlatform() && totalScanned !== undefined && !cancelled) {
           try {
             await LocalNotifications.schedule({
               notifications: [{
                 title: "Budget Tracker: SMS Scan",
                 body: `Scanned ${totalScanned} financial SMS. Imported ${newTxs?.length || 0} new transactions.`,
                 id: Math.floor(Math.random() * 1000000),
                 channelId: 'sms-sync',
                 schedule: { at: new Date(Date.now() + 1000) },
               }]
             });
           } catch(e) { console.error("Notification failed", e); }
        }

        if (isProUser && newTxs && newTxs.length > 0 && !cancelled) {
          console.log(`[FinanceContext] Auto-imported ${newTxs.length} SMS transactions`);
          const withCategory = newTxs.map(tx => ({
            ...tx,
            id:         uuidv4(),
            categoryId: autoCategory(tx.description, tx.type, loadedState.categories || DEFAULT_CATEGORIES),
          }));
          const merged = {
            ...loadedState,
            transactions: [...(loadedState.transactions || []), ...withCategory],
          };
          saveImmediate(merged);
          setState(merged);
        } else {
          setState(loadedState);
        }
        setLoading(false);
      }
    };

    if (!currentUser || currentUser.isAnonymous) {
      const saved = localStorage.getItem(STORAGE_KEY);
      let data = DEFAULT_STATE;
      try { if (saved) data = { ...DEFAULT_STATE, ...JSON.parse(saved) }; }
      catch (e) { console.warn("LocalStorage parse failed", e); }
      boot(data);
      return;
    }

    setLoading(true);
    let hasMigrated = false;
    const unsub = onSnapshot(doc(db, "users", currentUser.uid),
      (snap) => {
        let cloudData = snap.exists() ? snap.data() : null;
        
        // 1. Check for local data that needs migration
        const savedStr = localStorage.getItem(STORAGE_KEY);
        let localData = null;
         if (savedStr) {
           try {
             localData = JSON.parse(savedStr);
           } catch {
             console.warn("[FinanceContext] Failed to parse localData for migration.");
           }
         }

        if (cloudData) {
          let data = {
            ...DEFAULT_STATE,
            ...cloudData,
            theme:    cloudData.theme    || DEFAULT_STATE.theme,
            currency: cloudData.currency || DEFAULT_STATE.currency,
          };

          // Household fix: HOUSEHOLD_SHARED_FIELDS on this personal doc are
          // leftover/stale once a user is in a household (writes stopped
          // going here, but Firestore merge:true never deletes the old
          // values, it just stops touching them - see splitForHousehold).
          // Force these back to defaults so stale personal data can't leak
          // into `state` (and get duplicated into the household doc on the
          // next save) before the separate household onSnapshot listener
          // supplies the real shared values a moment later.
          if (data.householdId) {
            HOUSEHOLD_SHARED_FIELDS.forEach((f) => { data[f] = DEFAULT_STATE[f]; });
          }
          
          if (localData && !hasMigrated) {
             hasMigrated = true;
             localStorage.removeItem(STORAGE_KEY);
             
             // Merge Pro status and other primitive settings
             if (localData.subscription && localData.subscription !== 'free') {
                 data.subscription = localData.subscription;
             }
             if (localData.monthlyBudget) data.monthlyBudget = localData.monthlyBudget;
             if (localData.salaryDate) data.salaryDate = localData.salaryDate;
             
             // Merge transactions (simple deduplication by ID)
             if (localData.transactions && localData.transactions.length > 0) {
                 const existingIds = new Set((data.transactions || []).map(t => t.id));
                 const newTxs = localData.transactions.filter(t => !existingIds.has(t.id));
                 data.transactions = [...(data.transactions || []), ...newTxs];
             }
             // Merge categories
             if (localData.categories) {
                 const existingNames = new Set((data.categories || []).map(c => c.name));
                 const newCats = localData.categories.filter(c => !existingNames.has(c.name));
                 data.categories = [...(data.categories || []), ...newCats];
             }
             
             // Write back the merged data to cloud (this will trigger onSnapshot again, but hasMigrated is true now)
             setDoc(doc(db, "users", currentUser.uid), sanitizeForFirestore(data), { merge: true });
          }
          
          boot(data);
        } else {
          // NEW USER
          let data = DEFAULT_STATE;
          if (localData && !hasMigrated) {
              hasMigrated = true;
              data = { ...DEFAULT_STATE, ...localData };
              localStorage.removeItem(STORAGE_KEY);
          }
          setDoc(doc(db, "users", currentUser.uid), data).then(() => boot(data));
        }
      },
      (err) => { console.error("Firebase snapshot error", err); setLoading(false); }
    );

    return () => { cancelled = true; unsub(); };
  }, [currentUser, saveImmediate]);

  // ─── Household: subscribe to shared data once householdId is known ───────
  // Separate from the effect above on purpose - the vast majority of users
  // have no householdId, so this simply never subscribes for them (zero
  // behavior change). When it does fire, it merges the shared fields
  // (HOUSEHOLD_SHARED_FIELDS) on top of local state; setter functions like
  // addTransaction keep working unchanged since they all do
  // saveImmediate({ ...state, ... }) against this same merged state.
  useEffect(() => {
    const householdId = state.householdId;
    if (!householdId || !currentUser || currentUser.isAnonymous) return;

    const unsub = onSnapshot(doc(db, "households", householdId),
      (snap) => {
        if (!snap.exists()) return;
        const hdata = snap.data();
        setState(prev => {
          if (prev.householdId !== householdId) return prev; // left/switched mid-flight
          const merged = { ...prev };
          HOUSEHOLD_SHARED_FIELDS.forEach((f) => {
            if (hdata[f] !== undefined) merged[f] = hdata[f];
          });
          merged.householdMembers = hdata.members || {};
          merged.householdMeta = { name: hdata.name, ownerId: hdata.ownerId, memberIds: hdata.memberIds || [] };
          return merged;
        });
      },
      (err) => console.error("Household snapshot error", err)
    );
    return () => unsub();
  }, [state.householdId, currentUser]);

  // ─── Household: keep my own entry in the shared "members" map fresh ──────
  // So other members can see my name/photo and (for household-total math)
  // my personal balance-seed values, without ever needing to read my
  // personal users/{uid} doc (which Firestore rules don't allow them to).
  useEffect(() => {
    const householdId = state.householdId;
    if (!householdId || !currentUser || currentUser.isAnonymous) return;

    const memberInfo = {
      name: [state.profile?.firstName, state.profile?.lastName].filter(Boolean).join(" ")
        || currentUser.displayName || currentUser.email || "Member",
      photoURL: currentUser.photoURL || null,
      hideBalance: !!state.profile?.hideBalanceFromHousehold,
      initialBankBalances: state.initialBankBalances || {},
      initialCashBalance: state.initialCashBalance || 0,
      cashSeedDate: state.cashSeedDate || null,
    };

    setDoc(
      doc(db, "households", householdId),
      { members: { [currentUser.uid]: sanitizeForFirestore(memberInfo) } },
      { merge: true }
    ).catch((e) => console.error("Household member sync failed", e));
  }, [
    state.householdId, currentUser,
    state.profile?.firstName, state.profile?.lastName, state.profile?.hideBalanceFromHousehold,
    currentUser?.photoURL,
    state.initialBankBalances, state.initialCashBalance, state.cashSeedDate,
  ]);

  // ─── Household actions (call the /api/household/* backend) ──────────────
  const callHouseholdApi = async (endpoint, body) => {
    if (!currentUser) throw new Error("Not signed in");
    const idToken = await currentUser.getIdToken();
    const res = await fetch(apiUrl(`/api/household/${endpoint}`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  };

  const createHousehold = async (name) => {
    const res = await callHouseholdApi("create", { name });
    // Seed the new household doc's shared fields immediately (rather than
    // leaving them undefined until someone happens to save something) - the
    // owner's own current categories/budget make a sensible starting point.
    // Uses the householdId returned directly rather than waiting for local
    // state to catch up (avoids a race where state.householdId is still null).
    try {
      await setDoc(doc(db, "households", res.householdId), sanitizeForFirestore({
        transactions: [],
        categories: state.categories && state.categories.length > 0 ? state.categories : DEFAULT_CATEGORIES,
        recurring: [],
        loans: [],
        monthlyBudget: state.monthlyBudget || 50000,
        salaryDate: state.salaryDate || 1,
        accountingStartDate: null,
        lastProcessedMonth: "",
      }), { merge: true });
    } catch (e) {
      console.error("Household seed failed", e);
    }
    return res;
  };
  const joinHousehold = (code) => callHouseholdApi("accept", { code });
  const leaveHousehold = () => callHouseholdApi("remove", {});
  const removeHouseholdMember = (memberUid) => callHouseholdApi("remove", { memberUid });
  const regenerateInviteCode = () => callHouseholdApi("invite", {});
  const toggleBalancePrivacy = () => saveProfile({ hideBalanceFromHousehold: !state.profile?.hideBalanceFromHousehold });

  // ─── Subscription Status ─────────────────────────────────────────────────
  // isStarter = user has Starter plan (trial or paid) — unlocks everything except SMS
  const isPro = useMemo(() => {
    const sub = state.subscription;
    // Starter plan (trial or paid) gives access to all features except SMS
    if (sub === 'starter' || sub === 'monthly' || sub === 'yearly' || sub === 'lifetime') {
      return true;
    }
    if (sub === 'trial' && state.trialEndDate) {
      const remainingMs = new Date(state.trialEndDate) - new Date();
      return remainingMs > 0;
    }
    return false;
  }, [state.subscription, state.trialEndDate]);

  // isSmsUnlocked = ONLY for SMS auto-scan (separate Pro add-on, coming soon)
  const isSmsUnlocked = useMemo(() => {
    return state.subscription === 'sms_pro';
  }, [state.subscription]);

  // ─── Foreground rescan ────────────────────────────────────────────────────
  const rescanLock = useRef(false);
  const lastScan = useRef(0);
  const stateRef   = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const rescanTransactions = useCallback(async () => {
    const RESCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    if (!isSmsUnlocked || !window.Capacitor?.isNativePlatform() || rescanLock.current || (now - lastScan.current < RESCAN_INTERVAL_MS)) return { count: 0, totalScanned: 0 };
    
    rescanLock.current = true;
    lastScan.current = now;
    try {
      const current = stateRef.current;
      const { newTransactions: newTxs, totalScanned } = await autoScanTransactions(current.transactions || []);
      
      if (window.Capacitor?.isNativePlatform() && totalScanned !== undefined) {
         try {
           await LocalNotifications.schedule({
             notifications: [{
               title: "Budget Tracker: SMS Rescan",
               body: `Scanned ${totalScanned} financial SMS. Imported ${newTxs?.length || 0} new transactions.`,
               id: Math.floor(Math.random() * 1000000),
               channelId: 'sms-sync',
               schedule: { at: new Date(Date.now() + 1000) },
             }]
           });
         } catch(e) { console.error("Notification failed", e); }
      }

      if (newTxs && newTxs.length > 0) {
        const withCategory = newTxs.map(tx => ({
          ...tx,
          id:         uuidv4(),
          categoryId: autoCategory(tx.description, tx.type, current.categories || DEFAULT_CATEGORIES),
        }));
        const merged = {
          ...current,
          transactions: [...(current.transactions || []), ...withCategory],
        };
        saveImmediate(merged);
        return { count: newTxs.length, totalScanned };
      }
      return { count: 0, totalScanned };
    } catch (e) {
      console.error("[Rescan] Error:", e);
      throw e;
    } finally {
      rescanLock.current = false;
    }
  }, [saveImmediate]);

  // Re-scan when app comes to foreground or when sms_rescan is triggered
  useEffect(() => {
    if (!window.Capacitor?.isNativePlatform()) return;
    let listener;
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) rescanTransactions();
    }).then(l => { listener = l; });

    const handleRescan = () => {
      console.log("[FinanceContext] sms_rescan event triggered");
      rescanTransactions();
    };
    window.addEventListener("sms_rescan", handleRescan);

    return () => {
      listener?.remove();
      window.removeEventListener("sms_rescan", handleRescan);
    };
  }, [rescanTransactions]);

  // ─── Computed balances ────────────────────────────────────────────────────
  const validTransactions = React.useMemo(() => {
    const rawTxs = state.transactions || [];
    
    // Find known account endings for each bank
    const knownAccounts = {};
    rawTxs.forEach(t => {
      if (t.bankName && t.accountEnding && t.accountEnding !== 'null') {
        if (!knownAccounts[t.bankName]) knownAccounts[t.bankName] = new Set();
        knownAccounts[t.bankName].add(t.accountEnding);
      }
    });

    let txs = rawTxs
      .map(t => {
        let updatedT = { ...t };
        if (updatedT.source === 'sms' && updatedT.rawSms && updatedT.availableBalance === undefined) {
          updatedT.availableBalance = getAvailableBalance(updatedT.rawSms);
        }
        
        // Infer missing account ending if unambiguously known
        if (updatedT.bankName && (!updatedT.accountEnding || updatedT.accountEnding === 'null')) {
          if (knownAccounts[updatedT.bankName] && knownAccounts[updatedT.bankName].size === 1) {
            updatedT.accountEnding = Array.from(knownAccounts[updatedT.bankName])[0];
          }
        }
        return updatedT;
      })
      .filter(t => {
      if (t.source === 'sms') {
        if (!t.bankName || t.bankName === 'Unknown Bank' || t.bankName === 'Bank Account') return false;
        const isUPI = t.bankName === 'GPay/UPI' || t.bankName === 'PhonePe';
        if ((!t.accountEnding || t.accountEnding === 'null') && !isUPI) return false;
      }
      return true;
    });

    // --- Smart Deduplication ---
    const pdfAndManualTxs = txs.filter(t => t.source !== 'sms');
    const smsTxs = txs.filter(t => t.source === 'sms');

    const getLocalDay = (iso) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };

    const isGenericOrUpi = (name) => {
      const n = name ? name.toLowerCase() : '';
      return n === 'gpay/upi' || n === 'phonepe' || n === 'bank account' || n === 'unknown bank' || n === 'gpay' || n === 'google pay';
    };

    const matchedSmsIds = new Set();

    pdfAndManualTxs.forEach(pdf => {
      const pdfDateStr = getLocalDay(pdf.date);
      const pdfAmt = Math.abs(pdf.amount);
      
      const match = smsTxs.find(sms => {
        if (matchedSmsIds.has(sms.id)) return false;
        
        const smsDateStr = getLocalDay(sms.date);
        if (pdfDateStr !== smsDateStr) return false;
        
        const smsAmt = Math.abs(sms.amount);
        if (Math.abs(pdfAmt - smsAmt) > 0.01) return false;
        
        if (pdf.type !== sms.type) return false;
        
        const sameBank = pdf.bankName === sms.bankName || 
                         isGenericOrUpi(pdf.bankName) || 
                         isGenericOrUpi(sms.bankName);
        if (!sameBank) return false;
        
        const sameAccount = (pdf.accountEnding == null || sms.accountEnding == null || pdf.accountEnding === 'null' || sms.accountEnding === 'null')
          ? true 
          : pdf.accountEnding === sms.accountEnding;
        if (!sameAccount) return false;
        
        return true;
      });

      if (match) {
        matchedSmsIds.add(match.id);
      }
    });

    return [
      ...pdfAndManualTxs,
      ...smsTxs.filter(t => !matchedSmsIds.has(t.id))
    ];
  }, [state.transactions]);

  const filteredTransactions = React.useMemo(() => {
    if (!state.accountingStartDate) return validTransactions;
    const start = new Date(state.accountingStartDate);
    return validTransactions.filter(t => new Date(t.date) >= start);
  }, [validTransactions, state.accountingStartDate]);

  // In a household, transactions/categories/budget stay shared (everyone
  // sees everyone's entries - used above for `filteredTransactions` and
  // downstream budget/category spend calculations). But each person's
  // BANK/CASH BALANCE is their own - "myTransactions" narrows to just the
  // signed-in user's own entries, and only balance math below uses it.
  const myTransactions = React.useMemo(() => {
    if (!state.householdId) return validTransactions;
    return validTransactions.filter(t => !t.ownerId || t.ownerId === currentUser?.uid);
  }, [validTransactions, state.householdId, currentUser]);


  const cashBalance = React.useMemo(() => {
    return computeCashBalanceFor(myTransactions, state.initialCashBalance, state.cashSeedDate, state.accountingStartDate);
  }, [myTransactions, state.initialCashBalance, state.cashSeedDate, state.accountingStartDate]);

  // ─── Per-bank balances (for dashboard cards) ──────────────────────────────
  const bankAccountBalances = React.useMemo(() => {
    return computeBankAccountBalancesFor(myTransactions, state.initialBankBalances, state.accountingStartDate);
  }, [myTransactions, state.initialBankBalances, state.accountingStartDate]);


  const bankBalance = React.useMemo(() => {
    return bankAccountBalances.reduce((sum, b) => sum + b.balance, 0);
  }, [bankAccountBalances]);

  // ─── Household: per-member balances + total ──────────────────────────────
  // Every member gets the SAME precision here (per-bank-account, SMS-
  // anchored where available) - not an approximation. This works because
  // transactions are a shared field (so everyone's SMS-derived balance data
  // is already in the same list), and each member syncs their own seed
  // values (initialBankBalances/initialCashBalance/cashSeedDate) into
  // households/{id}.members.{uid} - Firestore rules don't allow reading
  // another member's personal users/{uid} doc directly, so this synced copy
  // is what makes it possible to compute their balance at all.
  const householdMemberBalances = React.useMemo(() => {
    if (!state.householdId || !state.householdMembers) return [];
    const members = state.householdMembers;
    return Object.keys(members).map((uid) => {
      const m = members[uid] || {};
      if (uid === currentUser?.uid) {
        return {
          uid, name: m.name || "Me", photoURL: m.photoURL || null,
          hideBalance: !!m.hideBalance, isMe: true,
          balance: bankBalance + cashBalance,
        };
      }

      const theirTx = validTransactions.filter(t => t.ownerId === uid);
      const theirBank = computeBankAccountBalancesFor(theirTx, m.initialBankBalances, state.accountingStartDate)
        .reduce((sum, b) => sum + b.balance, 0);
      const theirCash = computeCashBalanceFor(theirTx, m.initialCashBalance, m.cashSeedDate, state.accountingStartDate);

      return {
        uid, name: m.name || "Member", photoURL: m.photoURL || null,
        hideBalance: !!m.hideBalance, isMe: false,
        balance: theirBank + theirCash,
      };
    });
  }, [state.householdId, state.householdMembers, state.accountingStartDate, currentUser, bankBalance, cashBalance, validTransactions]);

  const householdTotalBalance = React.useMemo(() => {
    return householdMemberBalances.reduce((sum, m) => sum + m.balance, 0);
  }, [householdMemberBalances]);

  // ─── formatMoney ─────────────────────────────────────────────────────────
  const formatMoney = useCallback((amount) =>
    new Intl.NumberFormat(state.currency?.locale || "en-IN", {
      style: "currency", currency: state.currency?.code || "INR",
      maximumFractionDigits: 0, minimumFractionDigits: 0,
    }).format(amount), [state.currency]);

  // ─── Free Plan Transaction Limit ────────────────────────────────────────
  // Counts ALL transactions (income + expense + savings + debt) logged this calendar month.
  const monthlyTransactionCount = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    return (state.transactions || []).filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }, [state.transactions]);

  const transactionLimitReached = !isPro && monthlyTransactionCount >= FREE_PLAN_MONTHLY_TX_LIMIT;

  // ─── CRUD ────────────────────────────────────────────────────────────────
  const addTransaction = useCallback((tx) => {
    if (transactionLimitReached) {
      return { success: false, reason: "limit_reached", limit: FREE_PLAN_MONTHLY_TX_LIMIT };
    }
    const next = {
      ...state,
      transactions: [
        ...state.transactions,
        {
          ...tx,
          id: uuidv4(),
          date: tx.date || new Date().toISOString(),
          // Whose personal balance this affects. Always the creator, even
          // inside a household (shared visibility, separate balances).
          ownerId: tx.ownerId || currentUser?.uid || null,
        },
      ],
    };
    saveDebounced(next);
    return { success: true, transactionId: next.transactions[next.transactions.length - 1].id };
  }, [state, saveDebounced, transactionLimitReached, currentUser]);

  const addTransactions = useCallback((txList) => {
    if (transactionLimitReached) {
      return { success: false, reason: "limit_reached", limit: FREE_PLAN_MONTHLY_TX_LIMIT };
    }
    const next = {
      ...state,
      transactions: [
        ...state.transactions,
        ...txList.map(tx => ({
          ...tx,
          id: uuidv4(),
          date: tx.date || new Date().toISOString(),
          ownerId: tx.ownerId || currentUser?.uid || null,
        })),
      ],
    };
    saveImmediate(next);
  }, [state, saveImmediate, currentUser]);

  const addTransferTransaction = useCallback((txData, toMemberUid) => {
    if (!state.householdId) return { success: false, reason: "not_in_household" };
    if (transactionLimitReached) {
      return { success: false, reason: "limit_reached", limit: FREE_PLAN_MONTHLY_TX_LIMIT };
    }
    const transferGroupId = uuidv4();
    const date = txData.date || new Date().toISOString();
    const toName = state.householdMembers?.[toMemberUid]?.name || "member";
    const myName = state.profile?.firstName || "Me";

    const myTx = {
      ...txData, id: uuidv4(), date, type: "expense",
      ownerId: currentUser?.uid, transferGroupId, transferWith: toMemberUid,
      description: txData.description || `Sent to ${toName}`,
    };
    const theirTx = {
      ...txData, id: uuidv4(), date, type: "income",
      ownerId: toMemberUid, transferGroupId, transferWith: currentUser?.uid,
      description: txData.description || `Received from ${myName}`,
    };

    const next = { ...state, transactions: [...state.transactions, myTx, theirTx] };
    saveImmediate(next);
    return { success: true };
  }, [state, saveImmediate, currentUser, transactionLimitReached]);

  const updateTransaction = useCallback((id, updates) => {
    const next = { ...state, transactions: state.transactions.map(t => t.id === id ? { ...t, ...updates } : t) };
    saveDebounced(next);
  }, [state, saveDebounced]);

  const deleteTransaction = useCallback((id) => {
    const next = { ...state, transactions: state.transactions.filter(t => t.id !== id) };
    saveDebounced(next);
  }, [state, saveDebounced]);

  const adjustBankBalance = useCallback((bankName, accountEnding, newBalance) => {
    const currentBal = bankAccountBalances.find(b => b.bankName === bankName && b.accountEnding === accountEnding)?.balance || 0;
    const diff = newBalance - currentBal;
    if (diff === 0) return;

    const adjustmentTx = {
        id: uuidv4(),
        date: new Date().toISOString(),
        amount: Math.abs(diff),
        type: diff > 0 ? 'income' : 'expense',
        description: 'Manual Balance Adjustment',
        categoryId: 'manual_adjustment',
        bankName: bankName,
        accountEnding: accountEnding,
        availableBalance: newBalance,
        source: 'manual'
    };
    addTransaction(adjustmentTx);
  }, [bankAccountBalances, addTransaction]);

  const addCategory    = (cat)    => saveImmediate({ ...state, categories: [...state.categories, { ...cat, id: uuidv4() }] });
  const deleteCategory = (id)     => saveImmediate({ ...state, categories: state.categories.filter(c => c.id !== id) });
  const updateCategory = (id, up) => saveImmediate({ ...state, categories: state.categories.map(c => c.id === id ? { ...c, ...up } : c) });

  const updateCurrency    = (c)    => saveImmediate({ ...state, currency: c });
  const updateTheme       = (t)    => saveImmediate({ ...state, theme: { ...state.theme, ...t } });
  const updateSubscription= (s)    => saveImmediate({ ...state, subscription: s });

  // ─── Profile (collected at signup / profile-completion step) ──────────────
  // Returns the Firestore write promise so CompleteProfile.jsx can await it
  // and only navigate away (or show an error) once the save actually succeeds
  // or fails - previously this was fire-and-forget, so a failed write was
  // silently swallowed and the profile-completion prompt would reappear on
  // the next visit with no indication why.
  const saveProfile = (profileData) => {
    return saveImmediate({
      ...state,
      profile: { ...state.profile, ...profileData, profileComplete: true }
    });
  };

  const saveCategorySelection = (selectedCategories) => {
    const formattedCategories = selectedCategories.map(cat => ({
      id: cat.id || uuidv4(),
      name: cat.name,
      type: cat.type,
      color: cat.color || "#3b82f6",
      icon: cat.icon || "Tag",
      budget: cat.budget || 0
    }));
    return saveImmediate({
      ...state,
      categories: formattedCategories,
      profile: {
        ...state.profile,
        categoriesSelected: true
      }
    });
  };

  const deleteAccount = async () => {
    if (currentUser && !currentUser.isAnonymous) {
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          // Soft delete: move to deleted_users/{uid} with deletedAt timestamp
          await setDoc(doc(db, "deleted_users", currentUser.uid), {
            ...userData,
            deletedAt: new Date().toISOString(),
          });
          // Delete from users collection
          await deleteDoc(userDocRef);
        }
      } catch (e) {
        console.error("Soft delete failed in Firestore:", e);
      }
    }
    // Clear local storage
    localStorage.removeItem(STORAGE_KEY);
    // Sign out user
    if (logout) {
      await logout();
    }
    window.location.reload();
  };

  const checkDeletedAccount = async (uid) => {
    if (!uid) return null;
    try {
      const snap = await getDoc(doc(db, "deleted_users", uid));
      if (snap.exists()) {
        return snap.data();
      }
    } catch (e) {
      console.error("Error checking deleted account:", e);
    }
    return null;
  };

  const restoreDeletedAccount = async (uid) => {
    if (!uid) return false;
    try {
      const deletedSnap = await getDoc(doc(db, "deleted_users", uid));
      if (deletedSnap.exists()) {
        const data = deletedSnap.data();
        delete data.deletedAt;
        await setDoc(doc(db, "users", uid), data);
        await deleteDoc(doc(db, "deleted_users", uid));
        window.location.reload();
        return true;
      }
    } catch (e) {
      console.error("Error restoring deleted account:", e);
    }
    return false;
  };

  const startFreshAccount = async (uid) => {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, "deleted_users", uid));
    } catch (e) {
      console.error("Error permanently deleting old account data:", e);
    }
  };

  // ─── Coupon Redemption ──────────────────────────────────────────────────
  // Coupons live in Firestore at coupons/{CODE} with fields: { bonusDays: number, active: boolean }
  // Each user can redeem a given code only once (tracked in their own couponsRedeemed array).
  // Note: this check runs client-side against Firestore rules, not a Cloud Function —
  // sufficient for casual promo codes, not for high-value abuse-resistant coupons.
  const redeemCoupon = async (rawCode) => {
    const code = (rawCode || "").trim().toUpperCase();
    if (!code) return { success: false, message: "Enter a coupon code." };

    const alreadyUsed = (state.couponsRedeemed || []).includes(code);
    if (alreadyUsed) {
      return { success: false, message: "You've already redeemed this coupon." };
    }

    try {
      const couponSnap = await getDoc(doc(db, "coupons", code));
      if (!couponSnap.exists() || couponSnap.data()?.active === false) {
        return { success: false, message: "Invalid or expired coupon code." };
      }
      const bonusDays = Number(couponSnap.data()?.bonusDays) || 0;
      if (bonusDays <= 0) {
        return { success: false, message: "This coupon has no remaining value." };
      }

      const currentEnd = state.trialEndDate ? new Date(state.trialEndDate) : null;
      const base = currentEnd && currentEnd > new Date() ? currentEnd : new Date();
      const newTrialEndDate = new Date(base.getTime() + bonusDays * 24 * 60 * 60 * 1000).toISOString();

      saveImmediate({
        ...state,
        subscription: "trial",
        trialEndDate: newTrialEndDate,
        couponsRedeemed: [...(state.couponsRedeemed || []), code],
      });

      return { success: true, bonusDays, newTrialEndDate };
    } catch (e) {
      console.error("Coupon redemption failed", e);
      return { success: false, message: "Something went wrong. Please try again." };
    }
  };

  const updateBudget      = (b)    => saveImmediate({ ...state, monthlyBudget: parseFloat(b) });
  const updateSalaryDate  = (d)    => saveImmediate({ ...state, salaryDate: parseInt(d) });
  const updateAccountingStartDate = (date) => saveImmediate({ ...state, accountingStartDate: date || null });

  const updateStartingBalances = (bankBalances, cash, cashDate) =>
    saveImmediate({ ...state, initialBankBalances: bankBalances || {}, initialCashBalance: parseFloat(cash) || 0, cashSeedDate: cashDate || null });

  const addRecurring    = (r)  => saveImmediate({ ...state, recurring: [...(state.recurring || []), { ...r, id: uuidv4(), active: true }] });
  const deleteRecurring = (id) => saveImmediate({ ...state, recurring: (state.recurring || []).filter(r => r.id !== id) });
  const addLoan         = (l)  => saveImmediate({ ...state, loans: [...(state.loans || []), { ...l, id: uuidv4() }] });
  const deleteLoan      = (id) => saveImmediate({ ...state, loans: (state.loans || []).filter(l => l.id !== id) });

  const clearData = async () => {
    const fresh = { 
      ...DEFAULT_STATE, 
      theme: state.theme, 
      currency: state.currency,
      categories: state.categories,
      subscription: state.subscription,
      monthlyBudget: state.monthlyBudget,
      salaryDate: state.salaryDate,
      recurring: state.recurring,
      loans: state.loans
    };
    
    // 1. Force wipe local storage instantly to prevent ghost data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    
    // 2. Wipe Firebase safely
    if (currentUser && !currentUser.isAnonymous) {
      try {
        // Atomic single write: overwrites the entire document, effectively deleting unwanted arrays like transactions
        await setDoc(doc(db, "users", currentUser.uid), sanitizeForFirestore(fresh));
        // Wait to allow Firebase to process before reloading
        await new Promise(r => setTimeout(r, 500));
      } catch(e) {
        console.error("Firebase wipe failed", e);
      }
    } else {
        await new Promise(r => setTimeout(r, 100));
    }
    
    window.location.reload();
  };

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (state.theme?.mode === "system") {
      root.classList.add(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } else if (state.theme?.mode) {
      root.classList.add(state.theme.mode);
    }
    if (state.theme?.accent) root.setAttribute("data-theme", state.theme.accent);
  }, [state.theme]);


  const importData = useCallback((importedProps) => {
    const { categories: newCategories, transactions: newTransactions, ...otherSettings } = importedProps;
    const next = { ...state };
    
    // Merge settings like subscription, theme, monthlyBudget, etc.
    Object.keys(otherSettings).forEach(key => {
      if (otherSettings[key] !== undefined && otherSettings[key] !== null) {
        next[key] = otherSettings[key];
      }
    });

    if (newCategories && newCategories.length > 0) {
      next.categories = [...next.categories, ...newCategories.map(c => ({ ...c, id: c.id || uuidv4() }))];
    }
    if (newTransactions && newTransactions.length > 0) {
      const existingTxs = next.transactions || [];
      const existingCounts = {};
      
      existingTxs.forEach(t => {
        const dateStr = t.date.split('T')[0];
        const key = `${dateStr}_${Math.abs(t.amount)}_${t.type}_${t.bankName}_${t.accountEnding}_${t.description}`;
        existingCounts[key] = (existingCounts[key] || 0) + 1;
      });

      const uniqueNew = [];
      newTransactions.forEach(t => {
        const dateStr = (t.date || new Date().toISOString()).split('T')[0];
        const key = `${dateStr}_${Math.abs(t.amount)}_${t.type}_${t.bankName}_${t.accountEnding}_${t.description}`;
        
        if (existingCounts[key] && existingCounts[key] > 0) {
          existingCounts[key]--; // Skip duplicate
        } else {
          uniqueNew.push({ ...t, id: uuidv4(), date: t.date || new Date().toISOString() });
        }
      });

      next.transactions = [...existingTxs, ...uniqueNew];
    }
    saveImmediate(next);
  }, [state, saveImmediate]);

  const getLoanDetails = useCallback((loan) => {
    if (!loan) return { paid: 0, remaining: 0, progress: 0 };
    const principalPaid = validTransactions
      .filter(t => t.loanId === loan.id && (t.repaymentType !== 'interest'))
      .reduce((sum, t) => sum + t.amount, 0);
    const interestPaid = validTransactions
      .filter(t => t.loanId === loan.id && t.repaymentType === 'interest')
      .reduce((sum, t) => sum + t.amount, 0);

    if (loan.type === 'debt') {
      const principal = loan.principal || 0;
      const remaining = Math.max(principal - principalPaid, 0);
      const monthlyInterest = remaining * ((loan.interestRate || 0) / 100);
      return {
        paid: principalPaid,
        interestPaidTotal: interestPaid,
        remaining: remaining,
        monthlyInterest: monthlyInterest,
        progress: principal > 0 ? (principalPaid / principal) * 100 : 0
      };
    } else {
      const currentDate = new Date();
      const start = loan.startDate ? new Date(loan.startDate) : new Date();
      const monthsDiff = Math.max(0, (currentDate.getFullYear() - start.getFullYear()) * 12 + currentDate.getMonth() - start.getMonth());
      const activeMonths = Math.min(loan.tenure, monthsDiff);
      const principalPaid = activeMonths * loan.monthlyAmount;
      return {
        paid: principalPaid,
        remaining: (loan.monthlyAmount * loan.tenure) - principalPaid,
        monthlyInterest: 0,
        progress: 0
      };
    }
  }, [validTransactions]);

  const value = {
    // data
    categories:           state.categories   || [],
    transactions:         filteredTransactions,
    accountingStartDate:  state.accountingStartDate || null,
    currency:             state.currency,
    theme:                state.theme,
    subscription:         state.subscription,
    trialEndDate:         state.trialEndDate || null,
    isPro,
    isSmsUnlocked,
    profile:              state.profile || DEFAULT_STATE.profile,
    saveProfile,
    saveCategorySelection,
    deleteAccount,
    checkDeletedAccount,
    restoreDeletedAccount,
    startFreshAccount,
    couponsRedeemed:      state.couponsRedeemed || [],
    redeemCoupon,
    monthlyTransactionCount,
    transactionLimitReached,
    FREE_PLAN_MONTHLY_TX_LIMIT,
    recurring:            state.recurring     || [],
    loans:                state.loans         || [],
    monthlyBudget:        state.monthlyBudget || 50000,
    salaryDate:           state.salaryDate    || 1,
    initialBankBalances:  state.initialBankBalances || {},
    initialCashBalance:   state.initialCashBalance || 0,
    cashSeedDate:         state.cashSeedDate || null,
    loading,

    // ✅ NEW — use these on Dashboard
    bankBalance,
    cashBalance,
    totalBalance: bankBalance + cashBalance,
    bankAccountBalances,

    // Household (team sharing)
    householdId:            state.householdId || null,
    householdMeta:          state.householdMeta || null,
    householdMembers:       state.householdMembers || {},
    householdMemberBalances,
    householdTotalBalance,
    createHousehold, joinHousehold, leaveHousehold,
    removeHouseholdMember, regenerateInviteCode, toggleBalancePrivacy,
    addTransferTransaction,

    // helpers
    formatMoney,
    rescanTransactions,
    importData,
    getLoanDetails,
    adjustBankBalance,

    // CRUD
    addCategory, deleteCategory, updateCategory,
    addTransaction, addTransactions,
    updateTransaction, deleteTransaction,
    updateCurrency, updateTheme, updateSubscription,
    updateBudget, updateSalaryDate, updateAccountingStartDate, updateStartingBalances,
    addRecurringTransaction:    addRecurring,
    deleteRecurringTransaction: deleteRecurring,
    addLoan, deleteLoan,
    clearData,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be inside FinanceProvider");
  return ctx;
}
