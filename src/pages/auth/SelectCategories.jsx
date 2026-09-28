import React, { useState, useEffect, useMemo } from "react";
import { useFinanceData } from "../../hooks/useFinanceData";
import { useNavigate } from "react-router-dom";
import { SUGGESTED_CATEGORIES } from "../../context/FinanceContext";
import CategoryIcon from "../../components/CategoryIcon";
import { cn } from "../../lib/utils";
import {
    Loader2, AlertCircle, Wallet, ArrowRight, ArrowLeft, Plus, Check, X,
    Briefcase, TrendingUp, Utensils, Car, Home, Zap, Clapperboard,
    ShoppingBag, Coffee, ShieldCheck, CreditCard, HeartPulse, Sparkles,
    Gift, GraduationCap, Plane, BookOpen, Package, Tag, Laptop, Coins,
    Landmark, Globe, Calendar, Banknote, CheckCircle2
} from "lucide-react";

const CURRENCIES = [
    { code: 'INR', symbol: '₹', locale: 'en-IN', name: 'Indian Rupee' },
    { code: 'USD', symbol: '$', locale: 'en-US', name: 'United States Dollar' },
    { code: 'EUR', symbol: '€', locale: 'de-DE', name: 'Euro' },
    { code: 'GBP', symbol: '£', locale: 'en-GB', name: 'British Pound' },
    { code: 'AED', symbol: 'د.إ', locale: 'ar-AE', name: 'UAE Dirham' },
    { code: 'SGD', symbol: '$', locale: 'en-SG', name: 'Singapore Dollar' },
    { code: 'CAD', symbol: '$', locale: 'en-CA', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: '$', locale: 'en-AU', name: 'Australian Dollar' },
];

const ICON_OPTIONS = [
    { name: "Wallet", icon: Wallet },
    { name: "Briefcase", icon: Briefcase },
    { name: "TrendingUp", icon: TrendingUp },
    { name: "Utensils", icon: Utensils },
    { name: "Car", icon: Car },
    { name: "Home", icon: Home },
    { name: "Zap", icon: Zap },
    { name: "Clapperboard", icon: Clapperboard },
    { name: "ShoppingBag", icon: ShoppingBag },
    { name: "Coffee", icon: Coffee },
    { name: "ShieldCheck", icon: ShieldCheck },
    { name: "CreditCard", icon: CreditCard },
    { name: "HeartPulse", icon: HeartPulse },
    { name: "Sparkles", icon: Sparkles },
    { name: "Gift", icon: Gift },
    { name: "GraduationCap", icon: GraduationCap },
    { name: "Plane", icon: Plane },
    { name: "BookOpen", icon: BookOpen },
    { name: "Package", icon: Package },
    { name: "Tag", icon: Tag },
    { name: "Laptop", icon: Laptop },
    { name: "Coins", icon: Coins },
];

const COLOR_OPTIONS = [
    "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#6366f1",
    "#06b6d4", "#f97316", "#ec4899", "#8b5cf6", "#f472b6"
];

const TYPE_LABELS = {
    income: { label: "Income Categories", badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    expense: { label: "Expense Categories", badge: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    savings: { label: "Savings Goals", badge: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
    debt: { label: "Debt & EMI", badge: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
};

const PROFESSION_OPTIONS = ["Working Professional", "Business", "Student", "Home Maker/Housewife"];
const BANK_PRESETS = ['Indian Bank', 'Canara Bank', 'SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank'];

const WIZARD_STEPS = [
    { step: 1, title: "Preferences", label: "Cycle & Currency", icon: Globe },
    { step: 2, title: "Balances", label: "Starting Balances", icon: Landmark },
    { step: 3, title: "Categories", label: "Categories", icon: Tag },
];

const SelectCategories = () => {
    const {
        profile,
        currency,
        updateCurrency,
        salaryDate: currentSalaryDate,
        updateSalaryDate,
        updateStartingBalances,
        saveCategorySelection,
        saveProfile
    } = useFinanceData();
    const navigate = useNavigate();

    // Redirect to dashboard if user has already completed onboarding
    useEffect(() => {
        if (profile?.categoriesSelected) {
            navigate("/dashboard", { replace: true });
        }
    }, [profile?.categoriesSelected, navigate]);

    // Active Wizard Step: 1, 2, or 3
    const [currentStep, setCurrentStep] = useState(1);

    // ─── Step 1 State: Preferences ─────────────────────────────────────────────
    const [selectedCurrencyCode, setSelectedCurrencyCode] = useState(currency?.code || 'INR');
    const [salaryDay, setSalaryDay] = useState(currentSalaryDate || 1);
    const [currentProfession, setCurrentProfession] = useState(profile?.profession || "Working Professional");

    // ─── Step 2 State: Starting Balances ──────────────────────────────────────
    const [bankName, setBankName] = useState('Indian Bank');
    const [accountEnding, setAccountEnding] = useState('');
    const [bankBalance, setBankBalance] = useState('');
    const [cashBalance, setCashBalance] = useState('');

    // ─── Step 3 State: Categories ─────────────────────────────────────────────
    const [categories, setCategories] = useState(() => {
        const initialList = SUGGESTED_CATEGORIES[currentProfession] || SUGGESTED_CATEGORIES["Working Professional"];
        return initialList.map((cat, idx) => ({
            ...cat,
            id: `suggested_${idx}`,
            selected: true,
        }));
    });

    const handleProfessionChange = (newProf) => {
        setCurrentProfession(newProf);
        saveProfile({ profession: newProf });
        const newSuggested = SUGGESTED_CATEGORIES[newProf] || SUGGESTED_CATEGORIES["Working Professional"];
        setCategories(newSuggested.map((cat, idx) => ({
            ...cat,
            id: `suggested_${idx}`,
            selected: true,
        })));
    };

    const [addingType, setAddingType] = useState(null);
    const [customName, setCustomName] = useState("");
    const [customIcon, setCustomIcon] = useState("Tag");
    const [customColor, setCustomColor] = useState("#3b82f6");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const toggleCategory = (id) => {
        setCategories((prev) =>
            prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
        );
    };

    const handleAddCustom = (type) => {
        if (!customName.trim()) return;
        const newCat = {
            id: `custom_${Date.now()}`,
            name: customName.trim(),
            type,
            color: customColor,
            icon: customIcon,
            budget: 0,
            selected: true,
        };
        setCategories((prev) => [...prev, newCat]);
        setCustomName("");
        setAddingType(null);
    };

    // Calculate dynamic budget cycle preview
    const cyclePreview = useMemo(() => {
        const today = new Date();
        const sd = parseInt(salaryDay) || 1;
        const cycleStart = today.getDate() >= sd
            ? new Date(today.getFullYear(), today.getMonth(), sd)
            : new Date(today.getFullYear(), today.getMonth() - 1, sd);
        const cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, sd - 1);
        return `${cycleStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${cycleEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    }, [salaryDay]);

    // ─── Step Navigation ──────────────────────────────────────────────────────
    const handleNextFromStep1 = (e) => {
        e?.preventDefault();
        const curObj = CURRENCIES.find(c => c.code === selectedCurrencyCode);
        if (curObj && updateCurrency) updateCurrency(curObj);
        if (updateSalaryDate) updateSalaryDate(salaryDay);
        setCurrentStep(2);
    };

    const handleNextFromStep2 = (e) => {
        e?.preventDefault();
        saveStartingBalancesIfProvided();
        setCurrentStep(3);
    };

    const saveStartingBalancesIfProvided = () => {
        const bAmount = parseFloat(bankBalance);
        const cAmount = parseFloat(cashBalance);
        const bName = bankName.trim();
        const aEnding = accountEnding.trim() || '1234';

        const nextBankBalances = {};
        if (bName && !isNaN(bAmount) && bAmount > 0) {
            nextBankBalances[`${bName}_${aEnding}`] = {
                amount: bAmount,
                date: new Date().toISOString()
            };
        }

        const validCash = !isNaN(cAmount) && cAmount > 0 ? cAmount : 0;
        if (Object.keys(nextBankBalances).length > 0 || validCash > 0) {
            updateStartingBalances(
                nextBankBalances,
                validCash,
                new Date().toISOString()
            );
        }
    };

    // ─── Final Submit (Step 3) ────────────────────────────────────────────────
    const handleFinalSubmit = async (e) => {
        e.preventDefault();
        const selectedCategories = categories.filter((c) => c.selected);
        if (selectedCategories.length === 0) {
            setError("Please select at least one category to continue.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            // 1. Ensure preferences are saved
            const curObj = CURRENCIES.find(c => c.code === selectedCurrencyCode);
            if (curObj && updateCurrency) updateCurrency(curObj);
            if (updateSalaryDate) updateSalaryDate(salaryDay);

            // 2. Ensure starting balances are saved
            saveStartingBalancesIfProvided();

            // 3. Save categories and mark onboarding as complete
            await saveCategorySelection(selectedCategories);
            navigate("/dashboard");
        } catch (err) {
            console.error(err);
            setError("Failed to complete setup. Please try again.");
            setLoading(false);
        }
    };

    const types = ["income", "expense", "savings", "debt"];

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background ambient gradient glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-2xl my-6 space-y-6 animate-in fade-in duration-300">
                {/* ─── Top 3-Step Wizard Indicator ─── */}
                <div className="glass-strong rounded-2xl p-3 sm:p-4 border border-border/60 shadow-sm flex items-center justify-between gap-2">
                    {WIZARD_STEPS.map((s, idx) => {
                        const isDone = currentStep > s.step;
                        const isCurrent = currentStep === s.step;
                        return (
                            <React.Fragment key={s.step}>
                                <button
                                    type="button"
                                    onClick={() => isDone && setCurrentStep(s.step)}
                                    disabled={!isDone && !isCurrent}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all text-left",
                                        isCurrent && "bg-primary text-primary-foreground shadow-sm",
                                        isDone && "bg-muted/80 text-foreground hover:bg-muted cursor-pointer",
                                        !isDone && !isCurrent && "text-muted-foreground opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <div className={cn(
                                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                        isCurrent ? "bg-primary-foreground text-primary" : (isDone ? "bg-emerald-500 text-white" : "bg-muted-foreground/30 text-muted-foreground")
                                    )}>
                                        {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : s.step}
                                    </div>
                                    <span className="hidden sm:inline">{s.label}</span>
                                    <span className="sm:hidden">{s.title}</span>
                                </button>
                                {idx < WIZARD_STEPS.length - 1 && (
                                    <div className={cn(
                                        "h-0.5 flex-1 rounded transition-colors",
                                        currentStep > s.step ? "bg-emerald-500/70" : "bg-border"
                                    )} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {error && (
                    <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-2xl flex items-center gap-3 border border-destructive/20 animate-in fade-in">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 1: PREFERENCES & SALARY CYCLE
                    ══════════════════════════════════════════════════════════════ */}
                {currentStep === 1 && (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="glass-strong rounded-3xl p-6 sm:p-8 space-y-3 text-center border border-border">
                            <div className="flex justify-center">
                                <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl shadow-sm text-primary">
                                    <Globe className="w-7 h-7" />
                                </div>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                                Welcome to BudgetTracker!
                            </h1>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                Let’s personalize your accounting cycle, currency, and primary role so calculations match your life.
                            </p>
                        </div>

                        <div className="glass-strong rounded-3xl p-6 sm:p-8 space-y-6 border border-border">
                            {/* Currency Selector */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-primary" /> Preferred Currency
                                </label>
                                <select
                                    value={selectedCurrencyCode}
                                    onChange={(e) => setSelectedCurrencyCode(e.target.value)}
                                    className="flex h-12 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                >
                                    {CURRENCIES.map(c => (
                                        <option key={c.code} value={c.code}>
                                            {c.name} ({c.code} - {c.symbol})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Salary Reset Date */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-emerald-500" /> Monthly Salary / Reset Date
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    Your budget month will reset on this date every month.
                                </p>
                                <select
                                    value={salaryDay}
                                    onChange={(e) => setSalaryDay(parseInt(e.target.value))}
                                    className="flex h-12 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                >
                                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                        <option key={day} value={day}>
                                            {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of every month
                                        </option>
                                    ))}
                                </select>
                                <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-xs text-muted-foreground flex items-center justify-between">
                                    <span>First Budget Cycle:</span>
                                    <span className="font-semibold text-foreground">{cyclePreview}</span>
                                </div>
                            </div>

                            {/* Profession Selector */}
                            <div className="space-y-2.5">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-blue-500" /> Your Primary Role / Profession
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    We use this to automatically curate the most relevant budget categories for you.
                                </p>
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    {PROFESSION_OPTIONS.map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => handleProfessionChange(p)}
                                            className={cn(
                                                "p-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between shadow-sm",
                                                currentProfession === p
                                                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                                                    : "border-border bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                            )}
                                        >
                                            <span className="truncate">{p}</span>
                                            {currentProfession === p && <CheckCircle2 className="w-4 h-4 text-primary shrink-0 ml-1" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleNextFromStep1}
                                className="btn-primary w-full flex items-center justify-center gap-2 h-12 text-sm font-bold shadow-lg shadow-primary/20 mt-4 active:scale-[0.99]"
                            >
                                <span>Continue to Starting Balances</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 2: STARTING BALANCES (BANK & CASH)
                    ══════════════════════════════════════════════════════════════ */}
                {currentStep === 2 && (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="glass-strong rounded-3xl p-6 sm:p-8 space-y-3 text-center border border-border">
                            <div className="flex justify-center">
                                <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl shadow-sm text-primary">
                                    <Landmark className="w-7 h-7" />
                                </div>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                                Add Your Starting Balances
                            </h1>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                Enter your current balance in your primary bank and wallet so your net worth is accurate from day one.
                            </p>
                        </div>

                        <div className="glass-strong rounded-3xl p-6 sm:p-8 space-y-6 border border-border">
                            {/* Bank Account Section */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Landmark className="w-4 h-4 text-primary" /> Primary Bank Account
                                </label>

                                {/* Quick Presets */}
                                <div className="flex flex-wrap gap-1.5 pb-1">
                                    {BANK_PRESETS.map((b) => (
                                        <button
                                            key={b}
                                            type="button"
                                            onClick={() => setBankName(b)}
                                            className={cn(
                                                "text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all",
                                                bankName === b
                                                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                                            )}
                                        >
                                            {b}
                                        </button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Bank Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Indian Bank"
                                            value={bankName}
                                            onChange={(e) => setBankName(e.target.value)}
                                            className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-sm mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">A/C Ending (Last 4 Digits)</label>
                                        <input
                                            type="text"
                                            maxLength={4}
                                            placeholder="e.g. 5678 (optional)"
                                            value={accountEnding}
                                            onChange={(e) => setAccountEnding(e.target.value)}
                                            className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-sm mt-1"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Current Bank Balance ({selectedCurrencyCode})</label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3.5 top-3 text-muted-foreground font-semibold text-sm">
                                            {CURRENCIES.find(c => c.code === selectedCurrencyCode)?.symbol || '₹'}
                                        </span>
                                        <input
                                            type="number"
                                            placeholder="e.g. 50000"
                                            value={bankBalance}
                                            onChange={(e) => setBankBalance(e.target.value)}
                                            className="flex h-11 w-full pl-8 rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Cash in Hand Section */}
                            <div className="space-y-2 pt-3 border-t border-border/70">
                                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Banknote className="w-4 h-4 text-emerald-500" /> Cash in Hand (Wallet)
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    Physical cash currently in your pocket or home vault.
                                </p>
                                <div className="relative mt-1">
                                    <span className="absolute left-3.5 top-3 text-muted-foreground font-semibold text-sm">
                                        {CURRENCIES.find(c => c.code === selectedCurrencyCode)?.symbol || '₹'}
                                    </span>
                                    <input
                                        type="number"
                                        placeholder="e.g. 3000 (optional)"
                                        value={cashBalance}
                                        onChange={(e) => setCashBalance(e.target.value)}
                                        className="flex h-11 w-full pl-8 rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Step 2 Actions */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(1)}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-semibold hover:bg-muted transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Back</span>
                                </button>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(3)}
                                        className="text-xs text-muted-foreground hover:text-foreground font-semibold underline underline-offset-4 px-2"
                                    >
                                        Skip for now
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleNextFromStep2}
                                        className="btn-primary flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20"
                                    >
                                        <span>Next: Categories</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 3: CATEGORIES & PERSONALIZATION
                    ══════════════════════════════════════════════════════════════ */}
                {currentStep === 3 && (
                    <form onSubmit={handleFinalSubmit} className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="glass-strong rounded-3xl p-6 sm:p-8 space-y-4 text-center border border-border">
                            <div className="flex justify-center">
                                <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl shadow-sm text-primary">
                                    <Tag className="w-7 h-7" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                                    Select Your Categories
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Recommended based on: <strong className="text-foreground">{currentProfession}</strong>. Uncheck or add custom categories:
                                </p>
                            </div>
                        </div>

                        {/* Category Groups */}
                        {types.map((type) => {
                            const groupCats = categories.filter((c) => c.type === type);
                            return (
                                <div key={type} className="glass-strong rounded-3xl p-5 sm:p-6 space-y-4 border border-border">
                                    <div className="flex items-center justify-between">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${TYPE_LABELS[type].badge}`}>
                                            {TYPE_LABELS[type].label}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAddingType(type);
                                                setCustomColor(COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)]);
                                            }}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add Custom
                                        </button>
                                    </div>

                                    {/* List of Checkbox Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {groupCats.map((cat) => (
                                            <div
                                                key={cat.id}
                                                onClick={() => toggleCategory(cat.id)}
                                                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 ${
                                                    cat.selected
                                                        ? "bg-primary/10 border-primary/40 shadow-xs"
                                                        : "bg-muted/30 border-border hover:bg-muted/50 opacity-60"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div
                                                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                                                        style={{ backgroundColor: `${cat.color}20` }}
                                                    >
                                                        <CategoryIcon iconName={cat.icon} color={cat.color} size={18} />
                                                    </div>
                                                    <span className="text-sm font-semibold truncate text-foreground">
                                                        {cat.name}
                                                    </span>
                                                </div>

                                                <div
                                                    className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                                                        cat.selected
                                                            ? "bg-primary border-primary text-primary-foreground"
                                                            : "border-muted-foreground/40 bg-background"
                                                    }`}
                                                >
                                                    {cat.selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add Custom Category Inline Form */}
                                    {addingType === type && (
                                        <div className="mt-4 p-4 rounded-2xl bg-muted/60 border border-primary/30 space-y-3 animate-in fade-in">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-foreground">New {type} category</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setAddingType(null)}
                                                    className="text-muted-foreground hover:text-foreground p-1"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <input
                                                type="text"
                                                value={customName}
                                                onChange={(e) => setCustomName(e.target.value)}
                                                placeholder="Category Name"
                                                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                                                autoFocus
                                            />

                                            {/* Icon Picker */}
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                                    Icon
                                                </label>
                                                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1.5 border border-border rounded-xl bg-background">
                                                    {ICON_OPTIONS.map((item) => (
                                                        <button
                                                            key={item.name}
                                                            type="button"
                                                            onClick={() => setCustomIcon(item.name)}
                                                            className={`p-2 rounded-lg transition-colors ${
                                                                customIcon === item.name
                                                                    ? "bg-primary/20 text-primary border border-primary/40"
                                                                    : "text-muted-foreground hover:bg-muted"
                                                            }`}
                                                        >
                                                            <item.icon className="w-4 h-4" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Color Picker */}
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                                    Color
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {COLOR_OPTIONS.map((c) => (
                                                        <button
                                                            key={c}
                                                            type="button"
                                                            onClick={() => setCustomColor(c)}
                                                            className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                                                customColor === c ? "scale-110 border-white shadow" : "border-transparent"
                                                            }`}
                                                            style={{ backgroundColor: c }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleAddCustom(type)}
                                                disabled={!customName.trim()}
                                                className="btn-primary w-full py-2 text-xs font-bold disabled:opacity-50"
                                            >
                                                Add Category
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Step 3 Actions */}
                        <div className="glass-strong rounded-3xl p-6 text-center space-y-3 border border-border">
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(2)}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-semibold hover:bg-muted transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Back</span>
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary flex-1 inline-flex items-center justify-center gap-2 h-12 text-sm sm:text-base font-bold shadow-xl shadow-primary/25"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <span>Finish Setup & Launch Dashboard</span>
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                You can always update your preferences, bank accounts, or categories later in Settings.
                            </p>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default SelectCategories;
