import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext'; // Updated import path assuming sibling
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const FinanceContext = createContext();

const STORAGE_KEY = 'fintrack_data';

const DEFAULT_CATEGORIES = [
    { id: '1', name: 'Salary', type: 'income', color: '#10b981', icon: 'Wallet', budget: 0 },
    { id: '2', name: 'Freelance', type: 'income', color: '#3b82f6', icon: 'Laptop', budget: 0 },
    { id: '3', name: 'Food', type: 'expense', color: '#f59e0b', icon: 'Utensils', budget: 500 },
    { id: '4', name: 'Transport', type: 'expense', color: '#ef4444', icon: 'Car', budget: 200 },
    { id: '5', name: 'Utilities', type: 'expense', color: '#6366f1', icon: 'Zap', budget: 150 },
    { id: '6', name: 'Emergency Fund', type: 'savings', color: '#06b6d4', icon: 'ShieldCheck', budget: 0 },
    { id: '7', name: 'Credit Card', type: 'debt', color: '#f97316', icon: 'CreditCard', budget: 0 },
    { id: '8', name: 'Clothes', type: 'expense', color: '#ec4899', icon: 'ShoppingBag', budget: 100 },
    { id: '9', name: 'Coffee', type: 'expense', color: '#8b5cf6', icon: 'Coffee', budget: 50 },
    { id: '10', name: 'Beauty', type: 'expense', color: '#f472b6', icon: 'Sparkles', budget: 0 },
    { id: '11', name: 'Entertainment', type: 'expense', color: '#14b8a6', icon: 'Clapperboard', budget: 100 },
];

const DEFAULT_CURRENCY = { code: 'USD', symbol: '$', locale: 'en-US', name: 'United States Dollar' };
const DEFAULT_THEME = { mode: 'system', accent: 'blue' };

const DEFAULT_DATA = {
    categories: DEFAULT_CATEGORIES,
    transactions: [],
    currency: DEFAULT_CURRENCY,
    theme: DEFAULT_THEME,
    subscription: 'free', // 'free', 'monthly', 'lifetime'
    recurring: [], // [{ id, amount, description, type, categoryId, active: true }]
    loans: [], // [{ id, name, type: 'emi'|'debt', monthlyAmount, tenure, startDate, principal, interestRate }]
    monthlyBudget: 50000, // Default monthly budget
    lastProcessedMonth: '' // 'YYYY-MM' format to track when we last ran automation
};

export function FinanceProvider({ children }) {
    const { currentUser } = useAuth();
    const [data, setData] = useState(() => {
        // Initial load from local storage to prevent flicker, or default
        const saved = localStorage.getItem(STORAGE_KEY);
        try {
            return saved ? { ...DEFAULT_DATA, ...JSON.parse(saved) } : DEFAULT_DATA;
        } catch {
            return DEFAULT_DATA;
        }
    });

    const [loading, setLoading] = useState(true);

    // Automation: Check for recurring transactions based on frequency
    useEffect(() => {
        if (!data.recurring || data.recurring.length === 0) return;

        const today = new Date();
        // Helper to check if a date string is valid and return Date object
        const parseDate = (d) => d ? new Date(d) : null;

        // Helper to format date as YYYY-MM-DD for consistency
        const formatDate = (d) => d.toISOString().split('T')[0];

        let hasUpdates = false;

        const newTransactions = [];
        const updatedRecurring = data.recurring.map(rule => {
            if (!rule.active) return rule;

            // Default defaults for backward compatibility
            const frequency = rule.frequency || 'monthly';
            const interval = rule.interval || 1;
            const lastProcessed = parseDate(rule.lastProcessedDate);

            // Tenure Check (New)
            const tenure = rule.tenure ? parseInt(rule.tenure) : null;
            const processedCount = rule.processedCount ? parseInt(rule.processedCount) : 0;

            // If we have hit the tenure limit, deactivate and skip
            if (tenure && processedCount >= tenure) {
                if (rule.active) {
                    hasUpdates = true; // Need to save the active: false state
                    return { ...rule, active: false };
                }
                return rule;
            }

            // Logic to determine if we should run today
            let shouldRun = false;

            if (!lastProcessed) {
                // Never run before? Run today.
                shouldRun = true;
            } else {
                // Fix: Use calendar days difference manually to avoid import issues
                const oneDay = 1000 * 60 * 60 * 24;
                // Reset times to midnight for accurate day difference
                const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const lastMidnight = new Date(lastProcessed.getFullYear(), lastProcessed.getMonth(), lastProcessed.getDate());

                const diffDays = Math.round((todayMidnight - lastMidnight) / oneDay);

                if (frequency === 'monthly') {
                    // Check if one month has passed AND we are on/after the same day
                    // Method: Check if today is same month as start but later, OR next month
                    // Simpler: Compare months. If current > last, CHECK DAY.

                    const lastDate = lastProcessed.getDate(); // e.g., 15th
                    const currentDay = today.getDate();

                    const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
                    const lastMonthStr = rule.lastProcessedDate ? rule.lastProcessedDate.slice(0, 7) : '';

                    if (currentMonthStr > lastMonthStr) {
                        // Different month. Is it time yet?
                        // If today is 10th and due date is 15th, don't run yet.
                        // If today is 16th and due date is 15th, RUN.
                        if (currentDay >= lastDate) {
                            shouldRun = true;
                        }
                    } else if (currentMonthStr === lastMonthStr) {
                        // Same month, already ran (since lastProcessed is this month). Don't run.
                        shouldRun = false;
                    }
                } else if (frequency === 'weekly') {
                    // Check specific day of week if set
                    if (rule.weeklyDay !== undefined) {
                        const currentDay = today.getDay(); // 0-6
                        // Run if today is the selected day AND we haven't run today already
                        // Note: lastProcessedDate logic below ensures we don't run twice
                        // But if we missed yesterday? This simple logic only runs ON the day.
                        if (currentDay === rule.weeklyDay) {
                            shouldRun = true;
                            // Prevent double run if already ran today
                            if (lastProcessed && formatDate(lastProcessed) === formatDate(today)) {
                                shouldRun = false;
                            }
                        }
                    } else {
                        // Fallback to simple interval
                        if (diffDays >= 7) shouldRun = true;
                    }
                } else if (frequency === 'custom') {
                    // Custom days
                    if (diffDays >= interval) shouldRun = true;
                }
            }

            if (shouldRun) {
                console.log(`Auto-generating ${rule.description} (${frequency})`);
                newTransactions.push({
                    id: uuidv4(),
                    amount: rule.amount,
                    description: rule.description + ' (Auto)',
                    type: rule.type,
                    categoryId: rule.categoryId,
                    date: new Date().toISOString()
                });

                hasUpdates = true;

                // Update stats
                const newProcessedCount = processedCount + 1;
                const updates = {
                    lastProcessedDate: new Date().toISOString(),
                    processedCount: newProcessedCount
                };

                // Check if we just finished the tenure
                if (tenure && newProcessedCount >= tenure) {
                    updates.active = false;
                }

                return { ...rule, ...updates };
            }

            return rule;
        });

        if (hasUpdates) {
            const newData = {
                ...data,
                transactions: [...data.transactions, ...newTransactions],
                recurring: updatedRecurring
            };
            saveData(newData);
            console.log(`Generated ${newTransactions.length} automated transactions.`);
        }
    }, [data.recurring]);

    // Demo Data Seeding - REMOVED per user request
    /* 
    useEffect(() => {
       // Seeding logic removed
    }, []); 
    */

    // Sync with Firestore if logged in, else LocalStorage
    useEffect(() => {
        if (!currentUser || currentUser.isAnonymous) {
            // Fallback to LocalStorage persistence
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            setLoading(false);
            return;
        }

        const userDocRef = doc(db, 'users', currentUser.uid);

        // Real-time listener for Firestore
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                // Merge cloud data with default structure to ensure all fields exist
                const cloudData = docSnap.data();
                setData({
                    ...DEFAULT_DATA,
                    ...cloudData,
                    // Ensure theme/currency exist if not in cloud
                    theme: cloudData.theme || DEFAULT_DATA.theme,
                    currency: cloudData.currency || DEFAULT_DATA.currency
                });
            } else {
                // New user: Create initial document
                setDoc(userDocRef, DEFAULT_DATA);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching user data:", error);
        });

        return () => unsubscribe();
    }, [currentUser]); // Note: We don't depend on 'data' here to avoid loops, only write when 'save' is called

    // Helper to save data (Router between Cloud and Local)
    const saveData = (newData) => {
        setData(newData); // Optimistic update

        if (currentUser && !currentUser.isAnonymous) {
            const userDocRef = doc(db, 'users', currentUser.uid);
            setDoc(userDocRef, newData, { merge: true }).catch(err => {
                console.error("Failed to save to cloud", err);
                // Revert/Alert logic could go here
            });
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
    };

    // --- Actions ---

    // Apply Theme Side-effect (Separate effect as it touches DOM)
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (data.theme?.mode === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else if (data.theme?.mode) {
            root.classList.add(data.theme.mode);
        }

        if (data.theme?.accent) {
            root.setAttribute('data-theme', data.theme.accent);
        }
    }, [data.theme]);


    const addCategory = (category) => {
        const newData = {
            ...data,
            categories: [...data.categories, { ...category, id: category.id || uuidv4() }]
        };
        saveData(newData);
    };

    const deleteCategory = (id) => {
        const newData = {
            ...data,
            categories: data.categories.filter(c => c.id !== id)
        };
        saveData(newData);
    };

    const updateCategory = (id, updates) => {
        const newData = {
            ...data,
            categories: data.categories.map(c => c.id === id ? { ...c, ...updates } : c)
        };
        saveData(newData);
    };

    const addTransaction = (transaction) => {
        const newData = {
            ...data,
            transactions: [...data.transactions, { ...transaction, id: uuidv4(), date: transaction.date || new Date().toISOString() }]
        };
        saveData(newData);
    };

    const importData = ({ categories: newCategories, transactions: newTransactions }) => {
        const newData = { ...data };

        if (newCategories && newCategories.length > 0) {
            const cats = newCategories.map(c => ({ ...c, id: c.id || uuidv4() }));
            newData.categories = [...newData.categories, ...cats];
        }

        if (newTransactions && newTransactions.length > 0) {
            const txs = newTransactions.map(t => ({
                ...t,
                id: uuidv4(),
                date: t.date || new Date().toISOString()
            }));
            newData.transactions = [...newData.transactions, ...txs];
        }

        saveData(newData);
    };

    const addTransactions = (newTransactions) => {
        const timestamped = newTransactions.map(t => ({
            ...t,
            id: uuidv4(),
            date: t.date || new Date().toISOString()
        }));

        const newData = {
            ...data,
            transactions: [...data.transactions, ...timestamped]
        };
        saveData(newData);
    };

    const updateTransaction = (id, updatedFields) => {
        const newData = {
            ...data,
            transactions: data.transactions.map(t => t.id === id ? { ...t, ...updatedFields } : t)
        };
        saveData(newData);
    };

    const deleteTransaction = (id) => {
        const newData = {
            ...data,
            transactions: data.transactions.filter(t => t.id !== id)
        };
        saveData(newData);
    };

    const updateCurrency = (currency) => {
        const newData = { ...data, currency };
        saveData(newData);
    };

    const updateTheme = (newTheme) => {
        const newData = { ...data, theme: { ...data.theme, ...newTheme } };
        saveData(newData);
    };

    const updateSubscription = (status) => {
        const newData = { ...data, subscription: status };
        saveData(newData);
    };

    const updateBudget = (amount) => {
        const newData = { ...data, monthlyBudget: parseFloat(amount) };
        saveData(newData);
    };

    const addRecurringTransaction = (template) => {
        const newData = {
            ...data,
            recurring: [...(data.recurring || []), { ...template, id: uuidv4(), active: true }]
        };
        saveData(newData);
    };

    const deleteRecurringTransaction = (id) => {
        const newData = {
            ...data,
            recurring: (data.recurring || []).filter(i => i.id !== id)
        };
        saveData(newData);
    };

    const addLoan = (loan) => {
        const newData = {
            ...data,
            loans: [...(data.loans || []), { ...loan, id: uuidv4() }]
        };
        saveData(newData);
    };

    const deleteLoan = (id) => {
        const newData = {
            ...data,
            loans: (data.loans || []).filter(l => l.id !== id)
        };
        saveData(newData);
    };

    const clearData = () => {
        const newData = { ...DEFAULT_DATA, theme: data.theme, currency: data.currency }; // Keep theme/currency
        if (currentUser && !currentUser.isAnonymous) {
            // For cloud users, we might want to delete sub-collections or just update root. 
            // Updating root with empty arrays works for this simple structure.
            const userDocRef = doc(db, 'users', currentUser.uid);
            setDoc(userDocRef, newData).then(() => {
                window.location.reload();
            });
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
            setData(newData);
            window.location.reload();
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat(data.currency?.locale || 'en-US', {
            style: 'currency',
            currency: data.currency?.code || 'USD',
            maximumFractionDigits: 0,
            minimumFractionDigits: 0
        }).format(amount);
    };

    const getLoanDetails = (loan) => {
        if (!loan) return { paid: 0, remaining: 0, progress: 0 };

        // 1. Calculate Total Principal Repayments (exclude interest payments)
        const principalPaid = (data.transactions || [])
            .filter(t => t.loanId === loan.id && (t.repaymentType !== 'interest'))
            .reduce((sum, t) => sum + t.amount, 0);

        // Optional: Track interest paid specific to this loan (for stats if needed later)
        const interestPaid = (data.transactions || [])
            .filter(t => t.loanId === loan.id && t.repaymentType === 'interest')
            .reduce((sum, t) => sum + t.amount, 0);

        // 2. Calculate Stats based on Type
        if (loan.type === 'debt') {
            // Personal Debt: Principal + Interest
            // Remaining = Principal - Principal Paid
            // Monthly Interest = Remaining * (Rate/100)
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
            // Bank EMI (Legacy/Default)
            return {
                paid: principalPaid,
                remaining: (loan.monthlyAmount * loan.tenure) - principalPaid, // Rough estimate
                monthlyInterest: 0, // Hidden for EMI
                progress: 0 // Handled by date logic usually
            };
        }
    };

    const value = {
        categories: data.categories || [],
        transactions: data.transactions || [],
        currency: data.currency,
        theme: data.theme,
        loading,
        addCategory,
        deleteCategory,
        updateCategory,
        addTransaction,
        addTransactions,
        importData,
        updateTransaction,
        deleteTransaction,
        updateCurrency,
        updateTheme,
        updateSubscription,
        addRecurringTransaction,
        deleteRecurringTransaction,
        addLoan,
        deleteLoan,
        getLoanDetails,
        formatMoney,
        subscription: data.subscription,
        monthlyBudget: data.monthlyBudget || 50000,
        updateBudget,
        recurring: data.recurring || [],
        loans: data.loans || [],
        clearData
    };

    return (
        <FinanceContext.Provider value={value}>
            {children}
        </FinanceContext.Provider>
    );
}

export function useFinance() {
    return useContext(FinanceContext);
}
