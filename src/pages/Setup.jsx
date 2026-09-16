import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import { Plus, Trash2, Edit2, Check, X, Search, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '../lib/utils';
import CurrencySelector from '../components/CurrencySelector';
import ThemeSelector from '../components/ThemeSelector';
import CategoryIcon from '../components/CategoryIcon';

const COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#64748b'
];

// Valid icon names filtering out internal React/Lucide exports
const ICON_NAMES = Object.keys(LucideIcons).filter(name => name !== 'createLucideIcon' && name !== 'default');

const Setup = () => {
    const { 
        categories, addCategory, deleteCategory, updateCategory, 
        salaryDate, updateSalaryDate, initialBankBalances, bankAccountBalances, clearData,
        initialCashBalance, cashSeedDate, updateStartingBalances,
        accountingStartDate, updateAccountingStartDate,
        isSmsUnlocked
    } = useFinanceData();

    // Starting balances state
    const [tempBankBalances, setTempBankBalances] = useState({});
    const [tempCash, setTempCash] = useState('');
    const [tempCashDate, setTempCashDate] = useState('');

    // Notification toast state
    const [toast, setToast] = useState(null);
    const toastTimeoutRef = useRef(null);

    const showToast = (message, type = 'success') => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast({ message, type });
        toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        setTempBankBalances(initialBankBalances || {});
        setTempCash(initialCashBalance || '');
        setTempCashDate(cashSeedDate ? new Date(cashSeedDate).toISOString().split('T')[0] : '');
    }, [initialBankBalances, initialCashBalance, cashSeedDate]);

    const handleSaveBalances = () => {
        updateStartingBalances(tempBankBalances, tempCash, tempCashDate ? new Date(tempCashDate).toISOString() : null);
        showToast('Starting balances updated.');
    };

    // Category Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
    const [name, setName] = useState('');
    const [type, setType] = useState('expense');
    const [icon, setIcon] = useState('Wallet');
    const [color, setColor] = useState(COLORS[0]);
    const [editingId, setEditingId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Icon Picker state
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [iconSearch, setIconSearch] = useState('');

    const resetModalForm = () => {
        setName('');
        setType('expense');
        setIcon('Wallet');
        setColor(COLORS[0]);
        setEditingId(null);
        setShowIconPicker(false);
        setIconSearch('');
        setIsSaving(false);
    };

    const openAddModal = (defaultType = 'expense') => {
        resetModalForm();
        setType(defaultType);
        setIcon(defaultType === 'income' ? 'Wallet' : defaultType === 'savings' ? 'PiggyBank' : defaultType === 'debt' ? 'CreditCard' : 'ShoppingBag');
        setColor(defaultType === 'income' ? '#10b981' : defaultType === 'savings' ? '#06b6d4' : defaultType === 'debt' ? '#f97316' : '#f59e0b');
        setModalMode('add');
        setIsModalOpen(true);
    };

    const openEditModal = (cat) => {
        setEditingId(cat.id);
        setName(cat.name);
        setType(cat.type);
        setIcon(cat.icon || cat.emoji || 'Wallet');
        setColor(cat.color || COLORS[0]);
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        resetModalForm();
    };

    const getIconForName = (text) => {
        const lower = text.toLowerCase();
        if (lower.includes('salary') || lower.includes('income')) return 'Wallet';
        if (lower.includes('food') || lower.includes('meal')) return 'Utensils';
        if (lower.includes('grocery') || lower.includes('mart')) return 'ShoppingCart';
        if (lower.includes('transport') || lower.includes('car')) return 'Car';
        if (lower.includes('fuel') || lower.includes('gas') || lower.includes('petrol')) return 'Fuel';
        if (lower.includes('home') || lower.includes('rent')) return 'Home';
        if (lower.includes('shop') || lower.includes('buy')) return 'ShoppingBag';
        if (lower.includes('health') || lower.includes('doctor') || lower.includes('med')) return 'Stethoscope';
        if (lower.includes('gym') || lower.includes('fitness')) return 'Dumbbell';
        if (lower.includes('movie') || lower.includes('cinema')) return 'Clapperboard';
        if (lower.includes('education') || lower.includes('school') || lower.includes('college')) return 'GraduationCap';
        if (lower.includes('bill') || lower.includes('utility') || lower.includes('eb') || lower.includes('electricity')) return 'Zap';
        if (lower.includes('saving') || lower.includes('invest')) return 'PiggyBank';
        if (lower.includes('pet')) return 'Cat';
        if (lower.includes('gift')) return 'Gift';
        if (lower.includes('travel') || lower.includes('plane') || lower.includes('trip')) return 'Plane';
        return null;
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) return;

        setIsSaving(true);
        const categoryData = {
            name: trimmedName,
            type,
            icon,
            emoji: icon,
            color
        };

        try {
            if (editingId) {
                await updateCategory(editingId, categoryData);
                showToast(`Category "${trimmedName}" updated successfully!`);
            } else {
                await addCategory(categoryData);
                showToast(`Category "${trimmedName}" created successfully!`);
            }
            closeModal();
        } catch (err) {
            console.error("Error saving category:", err);
            showToast(`Failed to save: ${err.message || 'Unknown error'}`, 'error');
            setIsSaving(false);
        }
    };

    const handleDeleteCategory = async (cat) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete the "${cat.name}" category?\n\nNote: Any existing transactions with this category will remain safe.`
        );
        if (!confirmed) return;

        try {
            await deleteCategory(cat.id);
            showToast(`Category "${cat.name}" deleted.`);
        } catch (err) {
            console.error("Error deleting category:", err);
            showToast(`Failed to delete: ${err.message || 'Unknown error'}`, 'error');
        }
    };

    const getCategories = (t) => (categories || []).filter(c => c.type === t);

    const typeConfig = [
        { id: 'income', label: 'Income', icon: LucideIcons.TrendingUp, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
        { id: 'expense', label: 'Expense', icon: LucideIcons.TrendingDown, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
        { id: 'savings', label: 'Savings', icon: LucideIcons.PiggyBank, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
        { id: 'debt', label: 'Debt', icon: LucideIcons.CreditCard, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    ];

    // Filter icons based on search
    const filteredIcons = useMemo(() => {
        if (!iconSearch) return ICON_NAMES.slice(0, 100);
        return ICON_NAMES.filter(n => n.toLowerCase().includes(iconSearch.toLowerCase())).slice(0, 100);
    }, [iconSearch]);

    return (
        <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500 pb-20 relative">
            {/* Floating Toast Notification */}
            {toast && (
                <div className={cn(
                    "fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium border animate-in slide-in-from-top-4 fade-in duration-300",
                    toast.type === 'error'
                        ? "bg-destructive text-destructive-foreground border-destructive/30"
                        : "bg-background text-foreground border-border shadow-black/10 dark:shadow-black/40"
                )}>
                    {toast.type === 'error' ? (
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    )}
                    <span>{toast.message}</span>
                    <button onClick={() => setToast(null)} className="ml-2 text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Setup</h1>
                    <p className="text-muted-foreground">Customize categories, icons, and preferences.</p>
                </div>
                <button
                    onClick={() => openAddModal('expense')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm hover:shadow active:scale-[0.98]"
                >
                    <Plus className="w-4 h-4" />
                    <span>Create Category</span>
                </button>
            </header>

            <div className="grid gap-8 md:grid-cols-12">
                {/* Left Column: General Preferences */}
                <div className="space-y-6 md:col-span-5 order-2 md:order-1">
                    <ThemeSelector />
                    <CurrencySelector />

                    <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
                        <h3 className="font-semibold mb-1 flex items-center gap-2">
                            <span style={{ fontSize: '16px' }}>💰</span> Salary Date
                        </h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Your budget month resets on this date every month.
                        </p>
                        <div className="flex items-center gap-3">
                            <select
                                value={salaryDate}
                                onChange={(e) => {
                                    updateSalaryDate(e.target.value);
                                    showToast('Salary date updated.');
                                }}
                                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                            >
                                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                    <option key={day} value={day}>
                                        {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of every month
                                    </option>
                                ))}
                            </select>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                            Current cycle: {(() => {
                                const today = new Date();
                                const sd = salaryDate || 1;
                                const cycleStart = today.getDate() >= sd
                                    ? new Date(today.getFullYear(), today.getMonth(), sd)
                                    : new Date(today.getFullYear(), today.getMonth() - 1, sd);
                                const cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, sd - 1);
                                return `${cycleStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${cycleEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
                            })()}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
                        <h3 className="font-semibold mb-1 flex items-center gap-2">
                            <span style={{ fontSize: '16px' }}>📅</span> Accounting Start Date
                        </h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Transactions before this date will be hidden, and bank/cash balances will anchor to this date. Leave blank to show all history.
                        </p>
                        <div className="flex items-center gap-3">
                            <input
                                type="date"
                                value={accountingStartDate ? accountingStartDate.split('T')[0] : ''}
                                onChange={(e) => {
                                    updateAccountingStartDate(e.target.value ? new Date(e.target.value).toISOString() : null);
                                    showToast('Accounting start date updated.');
                                }}
                                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                            />
                            {accountingStartDate && (
                                <button
                                    onClick={() => {
                                        updateAccountingStartDate(null);
                                        showToast('Accounting start date reset.');
                                    }}
                                    className="p-2 text-muted-foreground hover:text-foreground bg-muted/50 rounded-xl hover:bg-muted"
                                    title="Reset Start Date"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
                        <h3 className="font-semibold mb-1 flex items-center gap-2">
                            <span style={{ fontSize: '16px' }}>🏦</span> Starting Balances
                        </h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Set your actual starting account balances for accurate tracking.
                        </p>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                {bankAccountBalances.map((acc) => {
                                    const key = `${acc.bankName}_${acc.accountEnding}`;
                                    const currentData = tempBankBalances[key] || { amount: '', date: '' };
                                    
                                    return (
                                        <div key={key} className="space-y-2 p-3 bg-muted/30 rounded-xl border border-border/50">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                                {acc.bankName} (A/C **** {acc.accountEnding})
                                            </label>
                                            
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-semibold">₹</span>
                                                    <input
                                                        type="number"
                                                        value={currentData.amount}
                                                        onChange={(e) => setTempBankBalances({
                                                            ...tempBankBalances,
                                                            [key]: { ...currentData, amount: e.target.value }
                                                        })}
                                                        onBlur={handleSaveBalances}
                                                        placeholder="Balance"
                                                        className="flex h-10 w-full pl-7 rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                                    />
                                                </div>
                                                <input
                                                    type="date"
                                                    value={currentData.date}
                                                    onChange={(e) => setTempBankBalances({
                                                        ...tempBankBalances,
                                                        [key]: { ...currentData, date: e.target.value }
                                                    })}
                                                    onBlur={handleSaveBalances}
                                                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}

                                {bankAccountBalances.length === 0 && (
                                    <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-xl text-center border border-dashed border-border">
                                        {isSmsUnlocked
                                            ? "Scan SMS to automatically detect and add your bank accounts here."
                                            : "Your active bank accounts will be listed here."}
                                    </div>
                                )}

                                <div className="space-y-2 p-3 bg-muted/30 rounded-xl border border-border/50 mt-4">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Cash in Hand (Wallet)</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-semibold">₹</span>
                                            <input
                                                type="number"
                                                value={tempCash}
                                                onChange={(e) => setTempCash(e.target.value)}
                                                onBlur={handleSaveBalances}
                                                placeholder="Balance"
                                                className="flex h-10 w-full pl-7 rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                            />
                                        </div>
                                        <input
                                            type="date"
                                            value={tempCashDate}
                                            onChange={(e) => setTempCashDate(e.target.value)}
                                            onBlur={handleSaveBalances}
                                            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 shadow-sm p-6">
                        <h3 className="font-semibold mb-1 flex items-center gap-2 text-red-500">
                            <span style={{ fontSize: '16px' }}>⚠️</span> Data Management
                        </h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            {isSmsUnlocked
                                ? "Clear all transaction data and settings. Use this to reset the app or to purge duplicate SMS transactions before a fresh scan."
                                : "Clear all transaction data and settings. Use this to reset the app to a clean state."}
                        </p>
                        <button
                            onClick={() => {
                                const confirmMsg = isSmsUnlocked
                                    ? "Are you sure you want to permanently clear all app data? You will need to rescan your SMS."
                                    : "Are you sure you want to permanently clear all app data? This action cannot be undone.";
                                if (window.confirm(confirmMsg)) {
                                    clearData();
                                }
                            }}
                            className="w-full bg-red-500 text-white font-medium py-2 rounded-xl text-sm hover:bg-red-600 transition shadow-sm"
                        >
                            Clear App Data & Restart
                        </button>
                    </div>
                </div>

                {/* Right Column: Category Lists */}
                <div className="space-y-6 md:col-span-7 order-1 md:order-2">
                    {typeConfig.map(t => {
                        const typeCats = getCategories(t.id);
                        return (
                            <div key={t.id} className="rounded-2xl border border-border bg-card shadow-sm p-6 transition-all hover:shadow-md">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold flex items-center gap-2">
                                        <div className={cn("p-2 rounded-lg bg-opacity-10", t.bg)}>
                                            <t.icon className={cn("w-5 h-5", t.color)} />
                                        </div>
                                        {t.label}
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground")}>
                                            {typeCats.length}
                                        </span>
                                        <button
                                            onClick={() => openAddModal(t.id)}
                                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
                                            title={`Add ${t.label} Category`}
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Add</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {typeCats.map(cat => (
                                        <div 
                                            key={cat.id} 
                                            className="group flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/70 transition-all border border-transparent hover:border-border"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-background shadow-sm border border-border/50 text-foreground">
                                                    <CategoryIcon iconName={cat.icon || cat.emoji} size={18} color={cat.color} />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm">{cat.name}</p>
                                                    <div className="w-12 h-1.5 rounded-full mt-1.5 opacity-80" style={{ backgroundColor: cat.color }} />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditModal(cat)}
                                                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                    title={`Edit ${cat.name}`}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCategory(cat)}
                                                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                                    title={`Delete ${cat.name}`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {typeCats.length === 0 && (
                                        <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border space-y-2">
                                            <p className="text-sm">No {t.label.toLowerCase()} categories yet.</p>
                                            <button
                                                onClick={() => openAddModal(t.id)}
                                                className="text-xs font-semibold text-primary hover:underline"
                                            >
                                                + Add first {t.label.toLowerCase()} category
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Category Modal (Add / Edit) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div 
                        className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-4 border-b border-border">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="p-2 rounded-lg bg-primary/10 text-primary">
                                    {modalMode === 'edit' ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                </span>
                                {modalMode === 'edit' ? 'Edit Category' : 'Add New Category'}
                            </h2>
                            <button 
                                onClick={closeModal} 
                                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCategory} className="space-y-5 pt-5">
                            {/* Type Selector */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</label>
                                <div className="grid grid-cols-4 gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50">
                                    {typeConfig.map(t => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setType(t.id)}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-lg text-xs font-semibold transition-all",
                                                type === t.id
                                                    ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                            )}
                                        >
                                            <t.icon className={cn("w-4 h-4", type === t.id ? t.color : "")} />
                                            <span>{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Icon & Category Name */}
                            <div className="flex gap-3 items-end">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Icon</label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowIconPicker(!showIconPicker)}
                                            className="w-12 h-12 flex items-center justify-center bg-muted/50 border border-input rounded-xl hover:bg-muted transition-colors text-primary shadow-sm"
                                            title="Choose Icon"
                                        >
                                            <CategoryIcon iconName={icon} size={24} />
                                        </button>

                                        {/* Lucide Icon Popover */}
                                        {showIconPicker && (
                                            <>
                                                <div 
                                                    className="fixed inset-0 z-40" 
                                                    onClick={() => setShowIconPicker(false)} 
                                                />
                                                <div className="absolute top-14 left-0 z-50 shadow-2xl rounded-2xl border border-border bg-popover w-[300px] sm:w-[340px] h-[360px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                                                    <div className="p-3 border-b border-border bg-muted/40">
                                                        <div className="relative">
                                                            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                placeholder="Search icons..."
                                                                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                                                value={iconSearch}
                                                                onChange={(e) => setIconSearch(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 overflow-y-auto p-2.5 grid grid-cols-5 gap-1.5 content-start">
                                                        {filteredIcons.map(iconName => (
                                                            <button
                                                                key={iconName}
                                                                type="button"
                                                                onClick={() => { setIcon(iconName); setShowIconPicker(false); }}
                                                                className={cn(
                                                                    "h-12 flex items-center justify-center rounded-xl hover:bg-muted transition-colors",
                                                                    icon === iconName ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground"
                                                                )}
                                                                title={iconName}
                                                            >
                                                                <CategoryIcon iconName={iconName} size={22} />
                                                            </button>
                                                        ))}
                                                        {filteredIcons.length === 0 && (
                                                            <div className="col-span-5 py-8 text-center text-xs text-muted-foreground">
                                                                No icons match "{iconSearch}"
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 flex-1">
                                    <label htmlFor="modal-cat-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Category Name
                                    </label>
                                    <input
                                        id="modal-cat-name"
                                        autoFocus
                                        type="text"
                                        value={name}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setName(val);
                                            if (modalMode === 'add') {
                                                const suggested = getIconForName(val);
                                                if (suggested) setIcon(suggested);
                                            }
                                        }}
                                        placeholder="e.g. Groceries, Investment, Rent..."
                                        className="flex h-12 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Color Picker */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Color Accent</label>
                                <div className="flex flex-wrap gap-2.5 p-2 bg-muted/30 rounded-xl border border-border/50">
                                    {COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className={cn(
                                                "w-7 h-7 rounded-full transition-all hover:scale-110 focus:outline-none flex items-center justify-center",
                                                color === c ? "ring-2 ring-offset-2 ring-primary scale-110 shadow" : ""
                                            )}
                                            style={{ backgroundColor: c }}
                                        >
                                            {color === c && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2.5 text-sm font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!name.trim() || isSaving}
                                    className="inline-flex items-center justify-center rounded-xl text-sm font-bold transition-all bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-5 gap-2 shadow-sm disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
                                >
                                    {isSaving ? (
                                        <span>Saving...</span>
                                    ) : modalMode === 'edit' ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            <span>Save Changes</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4" />
                                            <span>Create Category</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Setup;
