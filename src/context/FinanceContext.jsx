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
import { doc, setDoc, onSnapshot, deleteDoc } from "firebase/firestore";
import { db }                from "../lib/firebase";          // ← your firebase.js path
import { useAuth }           from "./AuthContext";       // ← your auth context path
import { autoScanTransactions, autoCategory, getAvailableBalance, parseSms } from "./autoScanSms";
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
          if (migrated) {
            console.log("[FinanceContext] Applied data migrations");
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

    let hasMigrated = false;
    const unsub = onSnapshot(doc(db, "users", currentUser.uid),
      (snap) => {
        let cloudData = snap.exists() ? snap.data() : null;
        
        // 1. Check for local data that needs migration
        const savedStr = localStorage.getItem(STORAGE_KEY);
        let localData = null;
        if (savedStr) {
           try { localData = JSON.parse(savedStr); } catch(e){}
        }

        if (cloudData) {
          let data = {
            ...DEFAULT_STATE,
            ...cloudData,
            theme:    cloudData.theme    || DEFAULT_STATE.theme,
            currency: cloudData.currency || DEFAULT_STATE.currency,
          };
          
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
             setDoc(doc(db, "users", currentUser.uid), data, { merge: true });
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

  // ─── Foreground rescan ────────────────────────────────────────────────────
  const rescanLock = useRef(false);
  const lastScan = useRef(0);
  const stateRef   = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const rescanTransactions = useCallback(async () => {
    const RESCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    if (!window.Capacitor?.isNativePlatform() || rescanLock.current || (now - lastScan.current < RESCAN_INTERVAL_MS)) return { count: 0, totalScanned: 0 };
    
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
    // If a PDF was imported, it might overlap with SMS transactions.
    // We count identical PDF transactions per local day to safely cancel out duplicate SMS ones.
    const pdfTxCounts = {};
    const getLocalDay = (iso) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };

    txs.forEach(t => {
      if (t.source !== 'sms') {
        const dateStr = getLocalDay(t.date);
        const key = `${dateStr}_${Math.abs(t.amount)}_${t.type}_${t.bankName || ''}_${t.accountEnding || ''}`;
        pdfTxCounts[key] = (pdfTxCounts[key] || 0) + 1;
      }
    });

    return txs.filter(t => {
      if (t.source === 'sms') {
        const dateStr = getLocalDay(t.date);
        const key = `${dateStr}_${Math.abs(t.amount)}_${t.type}_${t.bankName || ''}_${t.accountEnding || ''}`;
        if (pdfTxCounts[key] && pdfTxCounts[key] > 0) {
          pdfTxCounts[key]--; // Use up one match
          return false; // Drop this SMS duplicate!
        }
      }
      return true;
    });
  }, [state.transactions]);


  const cashBalance = React.useMemo(() => {
    const allTx   = validTransactions;
    const validTx = state.cashSeedDate ? allTx.filter(t => new Date(t.date) >= new Date(state.cashSeedDate)) : allTx;
    const cashIn  = validTx.filter(t => t.type === "income" && t.paymentMode === "cash");
    const atmOut  = validTx.filter(t =>
      t.type === "expense" &&
      (
        (t.description?.toLowerCase().includes("atm") && !t.description?.toLowerCase().includes("atm service branch")) || 
        t.description?.toLowerCase().includes("cash withdrawal")
      )
    );
    const cashOut = validTx.filter(t =>
      (t.type === "expense" || t.type === "debt") &&
      t.paymentMode === "cash" &&
      !(
        (t.description?.toLowerCase().includes("atm") && !t.description?.toLowerCase().includes("atm service branch")) || 
        t.description?.toLowerCase().includes("cash withdrawal")
      )
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
      const isUPI = t.bankName === 'GPay/UPI' || t.bankName === 'PhonePe';
      if (isUPI) return; // Do not create a bank card for UPI apps since they are not real accounts

      if (t.bankName && t.accountEnding) {
        const key = `${t.bankName}_${t.accountEnding}`;
        if (!map[key]) map[key] = { bankName: t.bankName, accountEnding: t.accountEnding, balance: 0, transactionCount: 0 };
        map[key].transactionCount++;
      }
    });

    Object.keys(map).forEach(key => {
      const accountTxs = allTx.filter(t => `${t.bankName}_${t.accountEnding}` === key);
      
      // We need a stable tie-breaker for identical dates (like PDF imports which all share T00:00:00)
      const txsWithIndex = accountTxs.map((t, i) => ({ ...t, _originalIdx: i }));
      
      const withBalance = txsWithIndex
        .filter(t => t.availableBalance != null)
        .sort((a, b) => {
          const dateDiff = new Date(b.date) - new Date(a.date);
          if (dateDiff !== 0) return dateDiff;
          return b._originalIdx - a._originalIdx; // LATER index = newer transaction
        });

      const seedData = state.initialBankBalances?.[key];
      const seedDate = seedData?.date ? new Date(seedData.date) : null;

      if (withBalance.length > 0) {
        const smsAnchor = withBalance[0];
        let computedBalance;
        let anchorDate;
        let anchorIdx = -1;

        if (seedDate && seedDate > new Date(smsAnchor.date)) {
          // Manual seed is newer than the latest SMS/PDF balance
          computedBalance = parseFloat(seedData.amount) || 0;
          anchorDate = seedDate;
        } else {
          // SMS/PDF balance is newer
          computedBalance = smsAnchor.availableBalance;
          anchorDate = new Date(smsAnchor.date);
          anchorIdx = smsAnchor._originalIdx;
        }

        txsWithIndex.forEach(t => {
          const tDate = new Date(t.date);
          // Only add transactions that happened strictly AFTER the anchor
          // If dates are identical (like same day PDF imports), only add if it appeared LATER in the array
          const isStrictlyNewer = tDate > anchorDate;
          const isSameTimeButNewer = (tDate.getTime() === anchorDate.getTime()) && (t._originalIdx > anchorIdx);

          if (isStrictlyNewer || isSameTimeButNewer) {
            // If this transaction has its own availableBalance, USE IT as the new anchor
            // instead of computing from type (which may be wrong for PDF imports)
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
        
        accountTxs.forEach(t => {
          if (seedDate && new Date(t.date) < seedDate) return;
          if (t.type === "income") computedBalance += t.amount;
          else if (t.type === "expense" || t.type === "debt") computedBalance -= t.amount;
        });
        map[key].balance = computedBalance;
      }
    });
    return Object.values(map);
  }, [validTransactions, state.initialBankBalances]);

  const bankBalance = React.useMemo(() => {
    return bankAccountBalances.reduce((sum, b) => sum + b.balance, 0);
  }, [bankAccountBalances]);

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
  const updateBudget      = (b)    => saveImmediate({ ...state, monthlyBudget: parseFloat(b) });
  const updateSalaryDate  = (d)    => saveImmediate({ ...state, salaryDate: parseInt(d) });

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
        await setDoc(doc(db, "users", currentUser.uid), fresh);
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
