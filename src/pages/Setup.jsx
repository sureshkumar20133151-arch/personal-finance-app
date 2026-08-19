import React, { useState, useMemo } from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import { Plus, Trash2, Edit2, Check, X, Search } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '../lib/utils';
import CurrencySelector from '../components/CurrencySelector';
import ThemeSelector from '../components/ThemeSelector';
import CategoryIcon from '../components/CategoryIcon';

const COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#64748b'
];

// Create a list of valid icon names to filter out internal React/Lucide exports
const ICON_NAMES = Object.keys(LucideIcons).filter(name => name !== 'createLucideIcon' && name !== 'default');

const Setup = () => {
    const { 
        categories, addCategory, deleteCategory, updateCategory, 
        salaryDate, updateSalaryDate, initialBankBalances, bankAccountBalances, clearData,
        initialCashBalance, cashSeedDate, updateStartingBalances,
        accountingStartDate, updateAccountingStartDate,
        isSmsUnlocked
    } = useFinanceData();

    // Form State
    const [name, setName] = useState('');
    const [tempBankBalances, setTempBankBalances] = useState({});
    const [tempCash, setTempCash] = useState('');
    const [tempCashDate, setTempCashDate] = useState('');

    React.useEffect(() => {
        setTempBankBalances(initialBankBalances || {});
        setTempCash(initialCashBalance || '');
        setTempCashDate(cashSeedDate ? new Date(cashSeedDate).toISOString().split('T')[0] : '');
    }, [initialBankBalances, initialCashBalance, cashSeedDate]);

    const handleSaveBalances = () => {
        updateStartingBalances(tempBankBalances, tempCash, tempCashDate ? new Date(tempCashDate).toISOString() : null);
    };
    const [type, setType] = useState('expense');
    const [icon, setIcon] = useState('Wallet'); // Default to Wallet icon
    const [color, setColor] = useState(COLORS[0]);
    const [editingId, setEditingId] = useState(null);

    const [showIconPicker, setShowIconPicker] = useState(false);
    const [iconSearch, setIconSearch] = useState('');

    const resetForm = () => {
        setName('');
        setType('expense');
        setIcon('Wallet');
        setColor(COLORS[0]);
        setEditingId(null);
        setShowIconPicker(false);
        setIconSearch('');
    };

    const getIconForName = (text) => {
        const lower = text.toLowerCase();
        if (lower.includes('salary') || lower.includes('income')) return 'Wallet';
        if (lower.includes('food') || lower.includes('meal')) return 'Utensils';
        if (lower.includes('grocery') || lower.includes('mart')) return 'ShoppingCart';
        if (lower.includes('transport') || lower.includes('car')) return 'Car';
        if (lower.includes('fuel') || lower.includes('gas')) return 'Fuel';
        if (lower.includes('home') || lower.includes('rent')) return 'Home';
        if (lower.includes('shop') || lower.includes('buy')) return 'ShoppingBag';
        if (lower.includes('health') || lower.includes('doctor')) return 'Stethoscope';
        if (lower.includes('gym') || lower.includes('fitness')) return 'Dumbbell';
        if (lower.includes('movie') || lower.includes('cinema')) return 'Clapperboard';
        if (lower.includes('education') || lower.includes('school')) return 'GraduationCap';
        if (lower.includes('bill') || lower.includes('utility')) return 'Zap';
        if (lower.includes('saving')) return 'PiggyBank';
        if (lower.includes('pet')) return 'Cat';
        if (lower.includes('gift')) return 'Gift';
        if (lower.includes('travel') || lower.includes('plane')) return 'Plane';
        return null;
    };

    const handleSave = (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        const categoryData = {
            name,
            type,
            icon,
            emoji: icon, // Backward compatibility or migration
            color
        };

        if (editingId) {
            updateCategory(editingId, categoryData);
        } else {
            addCategory(categoryData);
        }
        resetForm();
    };

    const handleEdit = (cat) => {
        setEditingId(cat.id);
        setName(cat.name);
        setType(cat.type);
        setIcon(cat.icon || cat.emoji || 'Wallet');
        setColor(cat.color || COLORS[0]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const getCategories = (t) => categories.filter(c => c.type === t);

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
        <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Setup</h1>
                <p className="text-muted-foreground">Customize categories, icons, and preferences.</p>
            </header>

            <div className="grid gap-8 md:grid-cols-12">
                {/* Left Column: Settings & Form */}
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
                                onChange={(e) => updateSalaryDate(e.target.value)}
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
                                onChange={(e) => updateAccountingStartDate(e.target.value ? new Date(e.target.value).toISOString() : null)}
                                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                            />
                            {accountingStartDate && (
                                <button
                                    onClick={() => updateAccountingStartDate(null)}
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
                                ? "Clear all transaction data and settings. Use this to reset the app or to purge wrongly parsed duplicate SMS transactions before a fresh scan."
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

                    <div className="rounded-2xl border border-border bg-card shadow-sm p-6 sticky top-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold">
                                {editingId ? 'Edit Category' : 'Add Category'}
                            </h2>
                            {editingId && (
                                <button onClick={resetForm} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-2 py-1 rounded-md transition-colors">
                                    <X className="w-3 h-3" /> Cancel
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSave} className="space-y-4">
                            {/* Type Selector */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</label>
                                <div className="grid grid-cols-4 gap-1 p-1 bg-muted/50 rounded-xl">
                                    {typeConfig.map(t => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setType(t.id)}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[10px] mobile:text-xs font-medium transition-all",
                                                type === t.id
                                                    ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                            )}
                                        >
                                            <t.icon className={cn("w-3 h-3 md:w-4 md:h-4", type === t.id ? t.color : "")} />
                                            <span className="hidden sm:inline">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Icon & Color Picker Row */}
                            <div className="flex gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium">Icon</label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowIconPicker(!showIconPicker)}
                                            className="w-12 h-12 flex items-center justify-center bg-muted/50 border border-input rounded-xl hover:bg-muted transition-colors text-primary"
                                        >
                                            <CategoryIcon iconName={icon} size={24} />
                                        </button>

                                        {/* Lucide Icon Popover */}
                                        {showIconPicker && (
                                            <div className="absolute top-14 left-0 z-50 shadow-xl rounded-xl border border-border bg-popover w-[320px] h-[400px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2">
                                                <div className="p-3 border-b border-border bg-muted/30">
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                                                        <input
                                                            id="icon-search"
                                                            name="iconSearch"
                                                            autoFocus
                                                            type="text"
                                                            placeholder="Search icons..."
                                                            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                                            value={iconSearch}
                                                            onChange={(e) => setIconSearch(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex-1 overflow-y-auto p-2 grid grid-cols-5 gap-1 content-start">
                                                    {filteredIcons.map(iconName => (
                                                        <button
                                                            key={iconName}
                                                            type="button"
                                                            onClick={() => { setIcon(iconName); setShowIconPicker(false); }}
                                                            className={cn(
                                                                "h-12 flex flex-col items-center justify-center rounded-lg hover:bg-muted transition-colors gap-1",
                                                                icon === iconName ? "bg-primary/10 text-primary" : "text-muted-foreground"
                                                            )}
                                                            title={iconName}
                                                        >
                                                            <CategoryIcon iconName={iconName} size={20} />
                                                        </button>
                                                    ))}
                                                    {filteredIcons.length === 0 && (
                                                        <div className="col-span-5 py-8 text-center text-xs text-muted-foreground">
                                                            No icons found.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {showIconPicker && (
                                            <div className="fixed inset-0 z-40" onClick={() => setShowIconPicker(false)} />
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 flex-1">
                                    <label htmlFor="category-name" className="text-xs font-medium">Name</label>
                                    <input
                                        id="category-name"
                                        name="categoryName"
                                        type="text"
                                        value={name}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setName(val);
                                            const suggested = getIconForName(val);
                                            if (suggested) setIcon(suggested);
                                        }}
                                        placeholder="e.g. Groceries"
                                        className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Color Picker */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium">Color Label</label>
                                <div className="flex flex-wrap gap-2">
                                    {COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className={cn(
                                                "w-6 h-6 rounded-full transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
                                                color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : ""
                                            )}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={!name.trim()}
                                className="w-full inline-flex items-center justify-center rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 mt-4 gap-2 shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                {editingId ? 'Save Changes' : 'Add Category'}
                            </button>
                        </form>
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
                                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground")}>
                                        {typeCats.length}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {typeCats.map(cat => (
                                        <div key={cat.id} className="group flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/70 transition-all border border-transparent hover:border-border">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-background shadow-sm border border-border/50 text-foreground">
                                                    <CategoryIcon iconName={cat.icon || cat.emoji} size={18} color={cat.color} />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm">{cat.name}</p>
                                                    {/* Color indicator without text */}
                                                    <div className="w-12 h-1.5 rounded-full mt-1.5 opacity-80" style={{ backgroundColor: cat.color }} />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(cat)}
                                                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteCategory(cat.id)}
                                                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {typeCats.length === 0 && (
                                        <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                                            <p className="text-sm">No categories yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default Setup;
