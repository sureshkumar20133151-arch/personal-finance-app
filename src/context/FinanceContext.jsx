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

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { registerPlugin }    from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db }                from "../lib/firebase";          // ← your firebase.js path
import { useAuth }           from "./AuthContext";       // ← your auth context path
import { autoScanTransactions, autoCategory } from "./autoScanSms";
import { v4 as uuidv4 }     from "uuid";

const App = registerPlugin("App");

// ─── Default data ─────────────────────────────────────────────────────────────
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
  theme:              { mode: "light", accent: "blue" },
  subscription:       "free",
  recurring:          [],
  loans:              [],
  monthlyBudget:      50000,
  lastProcessedMonth: "",
  salaryDate:         1,
  initialBankBalances: {},
  initialCashBalance: 0,
  cashSeedDate: null,
};

const STORAGE_KEY = "fintrack_data";

// ─── Context ──────────────────────────────────────────────────────────────────
const FinanceContext = createContext(undefined);

export function FinanceProvider({ children }) {
  const { currentUser } = useAuth();

  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    try { return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : DEFAULT_STATE; }
    catch { return DEFAULT_STATE; }
  });

  const [loading, setLoading] = useState(true);

  // ─── Persist ──────────────────────────────────────────────────────────────
  const persistDebounce = useRef(null);

  const saveImmediate = useCallback((data) => {
    setState(data);
    if (currentUser && !currentUser.isAnonymous) {
      setDoc(doc(db, "users", currentUser.uid), data, { merge: true })
        .catch(e => console.error("Firebase save failed", e));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [currentUser]);

  const saveDebounced = useCallback((data) => {
    setState(data);
    if (currentUser && !currentUser.isAnonymous) {
      if (persistDebounce.current) clearTimeout(persistDebounce.current);
      persistDebounce.current = setTimeout(() => {
        setDoc(doc(db, "users", currentUser.uid), data, { merge: true })
          .catch(e => console.error("Firebase save failed", e));
      }, 800);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [currentUser]);

  // ─── Load from Firebase / localStorage ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const boot = async (loadedState) => {
      if (!cancelled) {
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

        // Run auto SMS scan immediately after load
        const { newTransactions: newTxs, totalScanned, needsSetup } = await autoScanTransactions(loadedState.transactions || []);

        if (needsSetup && !cancelled) {
          // Notify app to show SmsSetupGuide modal
          window.dispatchEvent(new CustomEvent("sms_needs_setup"));
        }

        if (window.Capacitor?.isNativePlatform() && totalScanned !== undefined && !cancelled) {
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

        if (newTxs && newTxs.length > 0 && !cancelled) {
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

    const unsub = onSnapshot(doc(db, "users", currentUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = {
            ...DEFAULT_STATE,
            ...snap.data(),
            theme:    snap.data().theme    || DEFAULT_STATE.theme,
            currency: snap.data().currency || DEFAULT_STATE.currency,
          };
          boot(data);
        } else {
          setDoc(doc(db, "users", currentUser.uid), DEFAULT_STATE).then(() => boot(DEFAULT_STATE));
        }
      },
      (err) => { console.error("Firebase snapshot error", err); setLoading(false); }
    );

    return () => { cancelled = true; unsub(); };
  }, [currentUser, saveImmediate]);

  // ─── Foreground rescan ────────────────────────────────────────────────────
  const rescanLock = useRef(false);
  const stateRef   = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const rescanTransactions = useCallback(async () => {
    if (!window.Capacitor?.isNativePlatform() || rescanLock.current) return { count: 0, totalScanned: 0 };
    rescanLock.current = true;
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
    return (state.transactions || []).filter(t => {
      if (t.source === 'sms') {
        if (!t.bankName || t.bankName === 'Unknown Bank' || t.bankName === 'Bank Account') return false;
        if (!t.accountEnding || t.accountEnding === 'null') return false;
      }
      return true;
    });
  }, [state.transactions]);

  const bankBalance = React.useMemo(() => {
    const allTx = validTransactions;
    let totalInitial = 0;
    
    if (state.initialBankBalances) {
      Object.values(state.initialBankBalances).forEach(data => {
        totalInitial += parseFloat(data.amount) || 0;
      });
    }

    const validTx = allTx.filter(t => {
      const key = (t.bankName && t.accountEnding) ? `${t.bankName}_${t.accountEnding}` : null;
      const seedData = key ? state.initialBankBalances?.[key] : null;
      const seedDate = seedData?.date ? new Date(seedData.date) : null;
      return !(seedDate && new Date(t.date) < seedDate);
    });

    const bankIn  = validTx.filter(t => t.type === "income" && t.paymentMode !== "cash");
    const bankOut = validTx.filter(t =>
      (t.type === "expense" || t.type === "debt") &&
      (t.paymentMode !== "cash" || t.description?.toLowerCase().includes("atm") || t.description?.toLowerCase().includes("cash withdrawal"))
    );
    const inflow  = bankIn.reduce((s, t) => s + t.amount, 0);
    const outflow = bankOut.reduce((s, t) => s + t.amount, 0);
    return totalInitial + inflow - outflow;
  }, [validTransactions, state.initialBankBalances]);

  const cashBalance = React.useMemo(() => {
    const allTx   = validTransactions;
    const validTx = state.cashSeedDate ? allTx.filter(t => new Date(t.date) >= new Date(state.cashSeedDate)) : allTx;
    const cashIn  = validTx.filter(t => t.type === "income" && t.paymentMode === "cash");
    const atmOut  = validTx.filter(t =>
      t.type === "expense" &&
      (t.description?.toLowerCase().includes("atm") || t.description?.toLowerCase().includes("cash withdrawal"))
    );
    const cashOut = validTx.filter(t =>
      (t.type === "expense" || t.type === "debt") &&
      t.paymentMode === "cash" &&
      !t.description?.toLowerCase().includes("atm") &&
      !t.description?.toLowerCase().includes("cash withdrawal")
    );
    const inflow  = cashIn.reduce((s, t) => s + t.amount, 0) + atmOut.reduce((s, t) => s + t.amount, 0);
    const outflow = cashOut.reduce((s, t) => s + t.amount, 0);
    return (state.initialCashBalance || 0) + inflow - outflow;
  }, [validTransactions, state.initialCashBalance, state.cashSeedDate]);

  // ─── Per-bank balances (for dashboard cards) ──────────────────────────────
  const bankAccountBalances = React.useMemo(() => {
    const map = {};
    const allTx = validTransactions;

    if (state.initialBankBalances) {
      Object.entries(state.initialBankBalances).forEach(([key, data]) => {
        const [bankName, accountEnding] = key.split('_');
        map[key] = {
          bankName,
          accountEnding,
          balance: parseFloat(data.amount) || 0,
          transactionCount: 0
        };
      });
    }

    allTx.forEach(t => {
      if (t.bankName && t.accountEnding) {
        const key = `${t.bankName}_${t.accountEnding}`;
        const seedData = state.initialBankBalances?.[key];
        const seedDate = seedData?.date ? new Date(seedData.date) : null;
        
        if (seedDate && new Date(t.date) < seedDate) return;

        if (!map[key]) map[key] = { bankName: t.bankName, accountEnding: t.accountEnding, balance: 0, transactionCount: 0 };
        if (t.type === "income") map[key].balance += t.amount;
        else if (t.type === "expense" || t.type === "debt") map[key].balance -= t.amount;
        map[key].transactionCount++;
      }
    });
    return Object.values(map);
  }, [validTransactions, state.initialBankBalances]);

  // ─── formatMoney ─────────────────────────────────────────────────────────
  const formatMoney = useCallback((amount) =>
    new Intl.NumberFormat(state.currency?.locale || "en-IN", {
      style: "currency", currency: state.currency?.code || "INR",
      maximumFractionDigits: 0, minimumFractionDigits: 0,
    }).format(amount), [state.currency]);

  // ─── CRUD ────────────────────────────────────────────────────────────────
  const addTransaction = useCallback((tx) => {
    const next = {
      ...state,
      transactions: [...state.transactions, { ...tx, id: uuidv4(), date: tx.date || new Date().toISOString() }],
    };
    saveDebounced(next);
  }, [state, saveDebounced]);

  const addTransactions = useCallback((txList) => {
    const next = {
      ...state,
      transactions: [
        ...state.transactions,
        ...txList.map(tx => ({ ...tx, id: uuidv4(), date: tx.date || new Date().toISOString() })),
      ],
    };
    saveImmediate(next);
  }, [state, saveImmediate]);

  const updateTransaction = useCallback((id, updates) => {
    const next = { ...state, transactions: state.transactions.map(t => t.id === id ? { ...t, ...updates } : t) };
    saveDebounced(next);
  }, [state, saveDebounced]);

  const deleteTransaction = useCallback((id) => {
    const next = { ...state, transactions: state.transactions.filter(t => t.id !== id) };
    saveDebounced(next);
  }, [state, saveDebounced]);

  const addCategory    = (cat)    => saveImmediate({ ...state, categories: [...state.categories, { ...cat, id: uuidv4() }] });
  const deleteCategory = (id)     => saveImmediate({ ...state, categories: state.categories.filter(c => c.id !== id) });
  const updateCategory = (id, up) => saveImmediate({ ...state, categories: state.categories.map(c => c.id === id ? { ...c, ...up } : c) });

  const updateCurrency    = (c)    => saveImmediate({ ...state, currency: c });
  const updateTheme       = (t)    => saveImmediate({ ...state, theme: { ...state.theme, ...t } });
  const updateSubscription= (s)    => saveImmediate({ ...state, subscription: s });
  const updateBudget      = (b)    => saveImmediate({ ...state, monthlyBudget: parseFloat(b) });
  const updateSalaryDate  = (d)    => saveImmediate({ ...state, salaryDate: parseInt(d) });

  const updateStartingBalances = (bankBalances, cash, cashDate) =>
    saveImmediate({ ...state, initialBankBalances: bankBalances || {}, initialCashBalance: parseFloat(cash) || 0, cashSeedDate: cashDate || null });

  const addRecurring    = (r)  => saveImmediate({ ...state, recurring: [...(state.recurring || []), { ...r, id: uuidv4(), active: true }] });
  const deleteRecurring = (id) => saveImmediate({ ...state, recurring: (state.recurring || []).filter(r => r.id !== id) });
  const addLoan         = (l)  => saveImmediate({ ...state, loans: [...(state.loans || []), { ...l, id: uuidv4() }] });
  const deleteLoan      = (id) => saveImmediate({ ...state, loans: (state.loans || []).filter(l => l.id !== id) });

  const clearData = async () => {
    const fresh = { ...DEFAULT_STATE, theme: state.theme, currency: state.currency };
    
    // 1. Force wipe local storage instantly to prevent ghost data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    
    // 2. Wipe Firebase safely
    if (currentUser && !currentUser.isAnonymous) {
      try {
        await setDoc(doc(db, "users", currentUser.uid), fresh);
      } catch(e) {
        console.error("Firebase wipe failed", e);
      }
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


  const importData = useCallback(({ categories: newCategories, transactions: newTransactions }) => {
    const next = { ...state };
    if (newCategories && newCategories.length > 0) {
      next.categories = [...next.categories, ...newCategories.map(c => ({ ...c, id: c.id || uuidv4() }))];
    }
    if (newTransactions && newTransactions.length > 0) {
      next.transactions = [...next.transactions, ...newTransactions.map(t => ({ ...t, id: uuidv4(), date: t.date || new Date().toISOString() }))];
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
    transactions:         validTransactions,
    currency:             state.currency,
    theme:                state.theme,
    subscription:         state.subscription,
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
    clearData,
    bankAccountBalances,   // per-bank breakdown array

    // helpers
    formatMoney,
    rescanTransactions,
    importData,
    getLoanDetails,

    // CRUD
    addCategory, deleteCategory, updateCategory,
    addTransaction, addTransactions,
    updateTransaction, deleteTransaction,
    updateCurrency, updateTheme, updateSubscription,
    updateBudget, updateSalaryDate, updateStartingBalances,
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
