import React, { useState, useMemo, useEffect } from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import { cn } from '../lib/utils';
import { Target, AlertCircle, Check, MoreVertical, Edit2, Wallet, TrendingUp, PiggyBank } from 'lucide-react';
import CategoryIcon from '../components/CategoryIcon';
import BudgetTargetModal from '../components/BudgetTargetModal';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import CircleProgress from '../components/CircleProgress';
import { useNavigate } from 'react-router-dom';

const Budget = () => {
    const { categories, transactions, isPro, updateCategory, formatMoney, monthlyBudget } = useFinanceData();
    const navigate = useNavigate();

    // Selection State
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [editingTarget, setEditingTarget] = useState(false);
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [targetInputValue, setTargetInputValue] = useState('');

    // 1. Filter Expense Categories
    const expenseCategories = useMemo(() => {
        return categories.filter(c => c.type === 'expense');
    }, [categories]);

    // Calculate Total Category Budget
    const totalCategoryBudget = useMemo(() => {
        return expenseCategories.reduce((acc, cat) => acc + (cat.budget || 0), 0);
    }, [expenseCategories]);

    // Select first category by default on load
    useEffect(() => {
        if (!selectedCategoryId && expenseCategories.length > 0) {
            setSelectedCategoryId(expenseCategories[0].id);
        }
    }, [expenseCategories, selectedCategoryId]);

    // 2. Spending Calculations
    const categorySpending = useMemo(() => {
        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        const spending = {};

        transactions.forEach(tx => {
            if (tx.type === 'expense' && isWithinInterval(new Date(tx.date), { start, end })) {
                spending[tx.categoryId] = (spending[tx.categoryId] || 0) + tx.amount;
            }
        });
        return spending;
    }, [transactions]);

    // 3. Current Selected Category details
    const selectedCategory = useMemo(() => {
        return categories.find(c => c.id === selectedCategoryId);
    }, [categories, selectedCategoryId]);

    const stats = useMemo(() => {
        if (!selectedCategory) return null;
        const spent = categorySpending[selectedCategory.id] || 0;
        const target = selectedCategory.budget || 0;
        const remaining = target - spent;
        const percentage = target > 0 ? (spent / target) * 100 : 0;
        const isOver = spent > target && target > 0;

        return { spent, target, remaining, percentage, isOver };
    }, [selectedCategory, categorySpending]);

    // Handlers
    const handleSaveTarget = () => {
        if (selectedCategory) {
            updateCategory(selectedCategory.id, { budget: parseFloat(targetInputValue) || 0 });
            setEditingTarget(false);
        }
    };

    const startEditing = () => {
        if (!isPro) {
            if (confirm("Category budgets are a Pro feature. Would you like to upgrade to the Pro Plan?")) {
                navigate('/account');
            }
            return;
        }
        setTargetInputValue(selectedCategory?.budget?.toString() || '');
        setEditingTarget(true);
    };

    return (
        <div className="max-w-6xl mx-auto h-[calc(100vh-100px)] min-h-[600px] flex flex-col md:flex-row gap-6 animate-in fade-in">
            {/* Left Sidebar: Category List */}
            <div className="md:w-1/3 lg:w-1/4 bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/20 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-primary" />
                            Budget
                        </h2>
                        <button
                            onClick={() => {
                                if (!isPro) {
                                    if (confirm("Category budgets are a Pro feature. Would you like to upgrade to the Pro Plan?")) {
                                        navigate('/account');
                                    }
                                    return;
                                }
                                setShowTargetModal(true);
                            }}
                            className="text-xs font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                        >
                            Set Limit
                        </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <div className="flex-1 bg-background/50 p-2 rounded-lg border border-border/50">
                            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Allocated</span>
                            <span className="font-bold text-foreground">{formatMoney(totalCategoryBudget)}</span>
                        </div>
                        <div className="flex-1 bg-background/50 p-2 rounded-lg border border-border/50">
                            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Global Limit</span>
                            <span className="font-bold text-foreground">{formatMoney(monthlyBudget)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {expenseCategories.map(cat => {
                        const spent = categorySpending[cat.id] || 0;
                        const budget = cat.budget || 0;
                        const isOver = spent > budget && budget > 0;
                        const isSelected = selectedCategoryId === cat.id;

                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategoryId(cat.id)}
                                className={cn(
                                    "w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group",
                                    isSelected ? "bg-primary/10 border border-primary/20 shadow-sm" : "hover:bg-muted border border-transparent"
                                )}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-background border text-lg shadow-sm">
                                        <CategoryIcon iconName={cat.icon || cat.emoji} size={20} color={cat.color} />
                                    </div>
                                    <div className="truncate">
                                        <p className={cn("text-sm font-medium truncate", isSelected ? "text-primary" : "text-foreground")}>
                                            {cat.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {budget > 0 ? (
                                                isOver ? <span className="text-destructive">Overspent</span> : <span>{formatMoney(budget - spent)} left</span>
                                            ) : (
                                                'No target'
                                            )}
                                        </p>
                                    </div>
                                </div>
                                {isSelected && <div className="w-1 h-8 bg-primary rounded-full absolute right-0 mr-1" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Right Panel: Detailed Tracker */}
            <div className="flex-1 bg-card border border-border rounded-2xl shadow-sm overflow-y-auto">
                {selectedCategory && stats ? (
                    <div className="p-6 md:p-8 space-y-8">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center text-4xl border border-border shadow-sm">
                                    <CategoryIcon iconName={selectedCategory.icon || selectedCategory.emoji} size={32} color={selectedCategory.color} />
                                </div>
                                <div>
                                    <h1 className="text-2xl md:text-3xl font-bold">{selectedCategory.name}</h1>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={cn(
                                            "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                            stats.isOver ? "bg-destructive/10 text-destructive" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                        )}>
                                            {stats.isOver ? 'Needs Attention' : 'On Track'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button className="p-2 text-muted-foreground hover:bg-muted rounded-full">
                                <MoreVertical className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid lg:grid-cols-2 gap-8">
                            {/* Tracker Card */}
                            <div className="bg-background border border-border rounded-2xl p-6 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/20" />

                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <Target className="w-5 h-5 text-muted-foreground" />
                                        <span className="font-semibold text-lg">Target</span>
                                    </div>
                                    {!editingTarget && (
                                        <button onClick={startEditing} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {editingTarget ? (
                                    <div className="mb-6 animate-in fade-in space-y-3">
                                        <label htmlFor="target-budget" className="text-sm text-muted-foreground">Set your monthly spending limit</label>
                                        <div className="flex flex-col gap-3">
                                            <input
                                                id="target-budget"
                                                name="targetBudget"
                                                type="number"
                                                autoFocus
                                                value={targetInputValue}
                                                onChange={e => setTargetInputValue(e.target.value)}
                                                className="w-full bg-muted/50 border border-input rounded-xl px-4 py-2 text-lg font-bold"
                                                placeholder="0.00"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSaveTarget}
                                                    className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setEditingTarget(false)}
                                                    className="flex-1 bg-muted text-muted-foreground px-4 py-2 rounded-xl font-medium hover:bg-muted/80"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mb-8">
                                        <p className="text-sm text-muted-foreground mb-1">Monthly Limit</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-bold tracking-tight">
                                                {formatMoney(stats.target)}
                                            </span>
                                            {stats.target === 0 && (
                                                <span className="text-sm text-primary font-medium cursor-pointer" onClick={startEditing}>
                                                    Set a target
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4" />
                                            {stats.isOver
                                                ? `You've exceeded your limit by ${formatMoney(Math.abs(stats.remaining))}`
                                                : `${formatMoney(stats.remaining)} more available to spend`}
                                        </p>
                                    </div>
                                )}

                                {/* Progress Visualization */}
                                <div className="flex flex-col items-center justify-center py-6 bg-muted/10 rounded-xl border border-dashed border-border mb-6">
                                    <CircleProgress
                                        percentage={Math.min(stats.percentage, 100)}
                                        size={140}
                                        strokeWidth={12}
                                        color={stats.isOver ? "#ef4444" : "#10b981"}
                                        trackColor="var(--muted-foreground)"
                                        trackOpacity={0.1}
                                    />
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-3xl font-bold">{Math.round(stats.percentage)}%</span>
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Used</span>
                                    </div>
                                </div>

                                <div className="space-y-3 bg-muted/30 p-4 rounded-xl">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Amount to Spend This Month</span>
                                        <span className="font-bold">{formatMoney(stats.target)}</span>
                                    </div>
                                    <div className="w-full h-px bg-border" />
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Spent So Far</span>
                                        <span className={cn("font-bold", stats.isOver ? "text-destructive" : "text-foreground")}>
                                            {formatMoney(stats.spent)}
                                        </span>
                                    </div>
                                    <div className="w-full h-px bg-border" />
                                    <div className="flex justify-between items-center text-sm font-medium">
                                        <span className={stats.isOver ? "text-destructive" : "text-primary"}>
                                            {stats.isOver ? "Over Budget" : "Remaining"}
                                        </span>
                                        <span className={stats.isOver ? "text-destructive" : "text-primary"}>
                                            {formatMoney(stats.remaining)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Insight / Suggestion Card */}
                            <div className="space-y-6">
                                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                                    <h3 className="font-semibold flex items-center gap-2 mb-4">
                                        <PiggyBank className="w-5 h-5 text-primary" />
                                        Details
                                    </h3>
                                    <p className="text-sm text-foreground/80 leading-relaxed">
                                        {stats.isOver
                                            ? `You have exceeded your ${selectedCategory.name} budget. Consider reducing detailed expenses or adjusting your target.`
                                            : `You are doing great! You have spent ${formatMoney(stats.spent)} out of your ${formatMoney(stats.target)} target. Keep it up!`}
                                    </p>

                                    <div className="mt-6">
                                        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">Weekly Breakdown</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>Average Spend / Week</span>
                                                <span className="font-medium">~{formatMoney(stats.spent / 4)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span>Remaining / Week</span>
                                                <span className="font-medium">~{formatMoney(Math.max(stats.remaining, 0) / Math.max(1, (30 - new Date().getDate()) / 7))}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-10 text-center">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <Wallet className="w-8 h-8 opacity-50" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">Select a Category</h3>
                        <p className="max-w-xs">Review your spending targets and track your progress details.</p>
                    </div>
                )}
            </div>
            <BudgetTargetModal isOpen={showTargetModal} onClose={() => setShowTargetModal(false)} />
        </div>
    );
};

export default Budget;
