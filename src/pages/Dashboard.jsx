
import React, { useState, useMemo } from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from 'date-fns';
import { ArrowLeft, ArrowRight, TrendingUp, TrendingDown, PiggyBank, CreditCard, Calendar } from 'lucide-react';
import AnalyticsWidget from '../components/AnalyticsWidget';
import { cn } from '../lib/utils';
import CircleProgress from '../components/CircleProgress';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const TogglableChart = ({ titleA, titleB, iconA, iconB, dataA, dataB, totalA, totalB, colorA, colorB, formatMoney, defaultView = 'A' }) => {
    const [view, setView] = useState(defaultView);
    const isA = view === 'A';

    const toggleControls = (
        <div className="flex bg-muted p-1 rounded-lg">
            <button
                onClick={() => setView('A')}
                className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all", isA ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
                {titleA}
            </button>
            <button
                onClick={() => setView('B')}
                className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all", !isA ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
                {titleB}
            </button>
        </div>
    );

    return (
        <div className="relative">
            <AnalyticsWidget
                title={`${isA ? titleA : titleB} Breakdown`}
                icon={isA ? iconA : iconB}
                data={isA ? dataA : dataB}
                totalValue={isA ? totalA : totalB}
                formatMoney={formatMoney}
                colorClass={isA ? colorA : colorB}
                customControls={toggleControls}
            />
        </div>
    );
};

const Dashboard = () => {
    const { transactions = [], formatMoney, currency, categories = [], loans = [], recurring = [] } = useFinanceData();
    // const data = { loans }; // Mocking since useFinanceData returns flattened structure now
    const data = { loans }; // Creating a local wrapper to match my previous code or just use 'loans' directly.
    // Actually, let's just use 'loans' directly in the code above.
    // Correction: I used 'data.loans' in previous step. I should update that or this.
    // Let's update the hook usage to get 'loans' and then I'll use 'loans' variable.
    const [currentDate, setCurrentDate] = useState(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    // Filter transactions for the selected month
    const monthlyTransactions = transactions.filter(t => {
        const d = new Date(t.date);
        return d >= monthStart && d <= monthEnd;
    });

    const calculateTotal = (type) => monthlyTransactions
        .filter(t => t.type === type)
        .reduce((sum, t) => sum + t.amount, 0);

    const income = calculateTotal('income');
    const expense = calculateTotal('expense');
    const savings = calculateTotal('savings');
    const debt = calculateTotal('debt');

    // Balance calculation: Income - Expense - Savings - Debt? 
    // Or just Income - Expense? 
    // Usually Balance = Income - Expense. Savings is a transfer, Debt payment is an expense. 
    // But since they are separate types now: 
    // Let's assume Net Balance = Income - (Expense + Debt). Savings is still "money you have", just moved.
    // User might want to see how much they "saved" vs "spent".
    // Let's keep Balance as (Income - Expense - Debt). Treating Debt payments as outflows.
    // Balance calculation: Income - Expense - Debt
    // Balance calculation: Income - Expense - Debt
    const balance = income - expense - debt;

    // Percentages for Circular Progress (Divisor is Income, prevent div by zero)
    const getPercentage = (value) => {
        if (!income || income === 0) return 0;
        return Math.round((value / income) * 100); // Allow > 100%
    };

    const expensePct = getPercentage(expense);
    const savingsPct = getPercentage(savings);
    const debtPct = getPercentage(debt);

    // Net Remaining % (Balance / Income)
    const remainingPct = getPercentage(balance);

    // Upcoming Logic
    const upcomingExpenses = useMemo(() => {
        if (!recurring) return [];
        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        return recurring.filter(rule => rule.active && rule.type === 'expense').map(rule => {
            const parseDate = (d) => d ? new Date(d) : new Date();
            const lastRun = parseDate(rule.lastProcessedDate);
            const dueDay = lastRun.getDate();

            if (rule.frequency === 'monthly' && dueDay >= currentDay) {
                return {
                    ...rule,
                    dueDate: new Date(currentYear, currentMonth, dueDay)
                };
            }
            return null;
        }).filter(Boolean).sort((a, b) => a.dueDate - b.dueDate);
    }, [recurring]);

    const totalLoanEMI = (loans || []).reduce((sum, loan) => sum + (loan.monthlyAmount || 0), 0);
    const activeLoansCount = (loans || []).length;

    // Prepare data for Charts
    const getCategoryData = (type) => {
        const typeCategories = categories.filter(c => c.type === type);
        const data = typeCategories.map(cat => {
            const total = monthlyTransactions
                .filter(t => t.categoryId == cat.id)
                .reduce((sum, t) => sum + t.amount, 0);
            return { name: cat.name, value: total, color: cat.color };
        }).filter(item => item.value > 0);

        return data.sort((a, b) => b.value - a.value);
    };

    const incomeData = getCategoryData('income');
    const expenseData = getCategoryData('expense');
    const savingsData = getCategoryData('savings');
    const debtData = getCategoryData('debt');

    const previousMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* ... (header) */}

            {/* Summary Cards with Circular Progress */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Income (Now with Circle showing Remaining %) */}
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                                <TrendingUp className="w-4 h-4" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">Income</p>
                        </div>
                        <p className="text-2xl font-bold text-green-500">+{formatMoney(income)}</p>
                    </div>
                    {/* Visualizing "How much is left" or just Income? User asked for "remaining % of income" circle here */}
                    <div className="flex flex-col items-center">
                        <CircleProgress percentage={remainingPct} color="#10b981" />
                        <span className="text-[10px] text-muted-foreground mt-1">Remaining</span>
                    </div>
                </div>

                {/* Expenses */}
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
                                <TrendingDown className="w-4 h-4" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">Expenses</p>
                        </div>
                        <p className="text-2xl font-bold text-red-500">-{formatMoney(expense)}</p>
                    </div>
                    <CircleProgress percentage={expensePct} color="#ef4444" />
                </div>

                {/* Savings */}
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                                <PiggyBank className="w-4 h-4" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">Savings</p>
                        </div>
                        <p className="text-2xl font-bold text-blue-500">{formatMoney(savings)}</p>
                    </div>
                    <CircleProgress percentage={savingsPct} color="#3b82f6" />
                </div>

                {/* Debt */}
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400">
                                <CreditCard className="w-4 h-4" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">Debt</p>
                        </div>
                        <p className="text-2xl font-bold text-orange-500">{formatMoney(debt)}</p>
                    </div>
                    <CircleProgress percentage={debtPct} color="#f97316" />
                </div>
            </div>



            {/* Charts Section */}
            {/* Charts Section with Toggles */}
            <div className="grid gap-8 md:grid-cols-2">
                <TogglableChart
                    titleA="Income" titleB="Savings"
                    iconA={TrendingUp} iconB={PiggyBank}
                    dataA={incomeData} dataB={savingsData}
                    totalA={income} totalB={savings}
                    colorA="text-green-500" colorB="text-blue-500"
                    formatMoney={formatMoney}
                    defaultView="A"
                />

                <TogglableChart
                    titleA="Expense" titleB="Debt"
                    iconA={TrendingDown} iconB={CreditCard}
                    dataA={expenseData} dataB={debtData}
                    totalA={expense} totalB={debt}
                    colorA="text-destructive" colorB="text-orange-500"
                    formatMoney={formatMoney}
                    defaultView="A"
                />
            </div>




            {/* Upcoming Expenses (Full Width) */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Upcoming Expenses (This Month)
                </h3>

                {upcomingExpenses.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {upcomingExpenses.map(item => {
                            const daysUntil = Math.ceil((item.dueDate - new Date()) / (1000 * 60 * 60 * 24));
                            const isUrgent = daysUntil <= 7 && daysUntil >= 0;

                            return (
                                <div key={item.id} className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border transition-colors",
                                    isUrgent
                                        ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30"
                                        : "bg-muted/50 border-transparent hover:border-border"
                                )}>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={cn(
                                            "flex flex-col items-center justify-center w-10 h-10 rounded-lg text-xs font-bold leading-none shrink-0",
                                            isUrgent ? "bg-red-100 text-red-700" : "bg-background border shadow-sm text-foreground"
                                        )}>
                                            <span>{format(item.dueDate, 'dd')}</span>
                                            <span className="text-[9px] uppercase opacity-70">{format(item.dueDate, 'MMM')}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium truncate text-sm">{item.description}</p>
                                            {isUrgent && <p className="text-[10px] text-red-500 font-bold animate-pulse">Due in {daysUntil} days!</p>}
                                        </div>
                                    </div>
                                    <span className="font-bold whitespace-nowrap">{formatMoney(item.amount)}</span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border-dashed border-2">
                        <p>No upcoming recurring expenses for the remainder of this month.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
