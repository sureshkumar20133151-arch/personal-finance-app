
import React, { useState, useMemo, useCallback } from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import { format, subMonths, addMonths, isSameMonth } from 'date-fns';
import {
  ArrowLeft, ArrowRight, TrendingUp, TrendingDown,
  PiggyBank, CreditCard, Calendar, Share2,
  IndianRupee, Activity, Target, Zap
} from 'lucide-react';
import AnalyticsWidget from '../components/AnalyticsWidget';
import { cn } from '../lib/utils';
import CircleProgress from '../components/CircleProgress';

// ── Mini sparkline bar chart ──────────────────────────────────────────────────
const SparkBar = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all duration-300"
          style={{
            height: `${Math.max((v / max) * 100, 4)}%`,
            backgroundColor: color,
            opacity: 0.4 + (i / data.length) * 0.6,
          }}
        />
      ))}
    </div>
  );
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
const KPICard = ({ title, value, subValue, subLabel, icon: Icon, color, bgColor, sparkColor, sparkData, trend }) => (
  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
    <div className="flex items-start justify-between mb-3">
      <div className={cn('p-2 rounded-xl', bgColor)}>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      {trend !== undefined && trend !== null && (
        <span className={cn(
          'text-xs font-bold px-2 py-0.5 rounded-full',
          trend <= 0
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        )}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
    <p className={cn('text-2xl font-bold tracking-tight', color)}>{value}</p>
    {sparkData && (
      <div className="mt-3">
        <SparkBar data={sparkData} color={sparkColor} />
      </div>
    )}
    {subValue && (
      <p className="text-xs text-muted-foreground mt-2">
        <span className="font-medium text-foreground">{subValue}</span> {subLabel}
      </p>
    )}
  </div>
);

// ── Progress bar ──────────────────────────────────────────────────────────────
const ProgressBar = ({ label, value, max, color, formatMoney }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isOver = max > 0 && value > max;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-foreground truncate max-w-[150px]">{label}</span>
        <span className={cn('font-bold', isOver ? 'text-destructive' : 'text-muted-foreground')}>
          {formatMoney(value)}{max > 0 ? ` / ${formatMoney(max)}` : ''}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', isOver ? 'bg-destructive' : '')}
          style={{ width: `${pct}%`, backgroundColor: isOver ? undefined : color }}
        />
      </div>
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const {
    transactions = [], formatMoney, categories = [],
    loans = [], recurring = [], salaryDate, monthlyBudget
  } = useFinanceData();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');

  const sd = salaryDate || 1;

  const monthStart = useMemo(() =>
    new Date(currentDate.getFullYear(), currentDate.getMonth(), sd),
  [currentDate, sd]);

  const monthEnd = useMemo(() =>
    new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, sd - 1, 23, 59, 59),
  [monthStart, sd]);

  // Last 6 months for sparklines
  const last6Months = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(currentDate, 5 - i);
      const start = new Date(d.getFullYear(), d.getMonth(), sd);
      const end   = new Date(start.getFullYear(), start.getMonth() + 1, sd - 1, 23, 59, 59);
      return { start, end };
    }),
  [currentDate, sd]);

  const monthlyTx = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    }),
  [transactions, monthStart, monthEnd]);

  const calcTotal = useCallback((type, txList = monthlyTx) =>
    txList.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0),
  [monthlyTx]);

  const income  = useMemo(() => calcTotal('income'),  [calcTotal]);
  const expense = useMemo(() => calcTotal('expense'), [calcTotal]);
  const savings = useMemo(() => calcTotal('savings'), [calcTotal]);
  const debt    = useMemo(() => calcTotal('debt'),    [calcTotal]);
  const balance = income - expense - debt;

  // Sparklines (last 6 months per type)
  const sparkData = useMemo(() => {
    const types = ['income', 'expense', 'savings', 'debt'];
    const result = {};
    types.forEach(type => {
      result[type] = last6Months.map(({ start, end }) =>
        transactions
          .filter(t => t.type === type && new Date(t.date) >= start && new Date(t.date) <= end)
          .reduce((s, t) => s + t.amount, 0)
      );
    });
    return result;
  }, [transactions, last6Months]);

  // Month-over-month expense trend
  const prevMonthStart = useMemo(() => subMonths(monthStart, 1), [monthStart]);
  const prevMonthEnd   = useMemo(() => subMonths(monthEnd, 1),   [monthEnd]);
  const prevExpense = useMemo(() =>
    transactions
      .filter(t => t.type === 'expense' && new Date(t.date) >= prevMonthStart && new Date(t.date) <= prevMonthEnd)
      .reduce((s, t) => s + t.amount, 0),
  [transactions, prevMonthStart, prevMonthEnd]);
  const expenseTrend = prevExpense > 0
    ? Math.round(((expense - prevExpense) / prevExpense) * 100)
    : null;

  // Category spending
  const categorySpending = useMemo(() => {
    const map = {};
    monthlyTx.forEach(tx => {
      if (tx.type === 'expense') map[tx.categoryId] = (map[tx.categoryId] || 0) + tx.amount;
    });
    return map;
  }, [monthlyTx]);

  const expenseCategories = useMemo(() =>
    categories
      .filter(c => c.type === 'expense')
      .map(c => ({ ...c, spent: categorySpending[c.id] || 0 }))
      .filter(c => c.spent > 0 || c.budget > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 8),
  [categories, categorySpending]);

  // Chart data
  const getCategoryData = useCallback((type) =>
    categories
      .filter(c => c.type === type)
      .map(cat => ({
        name: cat.name,
        value: monthlyTx.filter(t => t.categoryId === cat.id).reduce((s, t) => s + t.amount, 0),
        color: cat.color,
      }))
      .filter(i => i.value > 0)
      .sort((a, b) => b.value - a.value),
  [categories, monthlyTx]);

  const expenseData = useMemo(() => getCategoryData('expense'), [getCategoryData]);
  const incomeData  = useMemo(() => getCategoryData('income'),  [getCategoryData]);

  // Upcoming recurring this month
  const upcomingExpenses = useMemo(() => {
    const today = new Date();
    return (recurring || [])
      .filter(r => r.active && r.type === 'expense')
      .map(r => {
        const lastRun = r.lastProcessedDate ? new Date(r.lastProcessedDate) : new Date();
        const dueDay  = lastRun.getDate();
        if (r.frequency === 'monthly' && dueDay >= today.getDate()) {
          return { ...r, dueDate: new Date(today.getFullYear(), today.getMonth(), dueDay) };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.dueDate - b.dueDate)
      .slice(0, 4);
  }, [recurring]);

  const totalEMI    = useMemo(() => loans.reduce((s, l) => s + (l.monthlyAmount || 0), 0), [loans]);
  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;
  const budgetUsed  = monthlyBudget > 0 ? Math.round((expense / monthlyBudget) * 100) : 0;

  // Budget Health computations
  const totalOutflow     = expense + debt + savings;
  const budgetHealth     = monthlyBudget > 0 ? Math.min((totalOutflow / monthlyBudget) * 100, 150) : 0;
  const remaining        = monthlyBudget - totalOutflow;
  const isOverBudget     = monthlyBudget > 0 && totalOutflow > monthlyBudget;
  const today            = new Date();
  const daysLeft         = Math.max(Math.ceil((monthEnd - today) / (1000 * 60 * 60 * 24)), 0);
  const daysPassed       = Math.max(Math.ceil((today - monthStart) / (1000 * 60 * 60 * 24)), 1);
  const dailyBurnRate    = totalOutflow / daysPassed;
  const projectedMonthly = dailyBurnRate * 30;

  const previousMonth = () => setCurrentDate(d => subMonths(d, 1));
  const nextMonth     = () => setCurrentDate(d => addMonths(d, 1));

  const handleShare = useCallback(() => {
    const monthName = format(currentDate, 'MMMM yyyy');
    const top = expenseData[0];
    const rate = income > 0 ? Math.round((balance / income) * 100) : 0;
    const message =
      `💰 *${monthName} Financial Summary*\n\n` +
      `✅ Income: ${formatMoney(income)}\n` +
      `🛒 Expenses: ${formatMoney(expense)}\n` +
      `📈 Savings: ${formatMoney(savings)}\n` +
      `💳 Debt Paid: ${formatMoney(debt)}\n` +
      `🏦 Net Balance: ${formatMoney(balance)}\n\n` +
      `📊 Savings Rate: ${rate}%\n` +
      (top ? `🔺 Top Spend: ${top.name} (${formatMoney(top.value)})\n` : '') +
      `\n_Tracked with BudgetTracker_ 🇮🇳`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  }, [currentDate, income, expense, savings, debt, balance, expenseData, formatMoney]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {format(monthStart, 'dd MMM')} – {format(monthEnd, 'dd MMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 shadow-sm">
            <button
              onClick={previousMonth}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              title="Previous month"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-sm font-semibold min-w-[100px] text-center">
              {format(currentDate, 'MMM yyyy')}
            </span>
            <button
              onClick={nextMonth}
              disabled={isSameMonth(currentDate, new Date())}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next month"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-green-500/25"
            title="Share on WhatsApp"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* ── Tab Nav ── */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'spending', label: 'Spending', icon: TrendingDown },
          { id: 'goals',    label: 'Goals',    icon: Target },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total Income"
              value={formatMoney(income)}
              icon={TrendingUp}
              color="text-green-500"
              bgColor="bg-green-100 dark:bg-green-900/30"
              sparkData={sparkData.income}
              sparkColor="#10b981"
              subValue={`${savingsRate}%`}
              subLabel="savings rate"
            />
            <KPICard
              title="Total Expenses"
              value={formatMoney(expense)}
              icon={TrendingDown}
              color="text-red-500"
              bgColor="bg-red-100 dark:bg-red-900/30"
              sparkData={sparkData.expense}
              sparkColor="#ef4444"
              trend={expenseTrend}
              subValue={`${budgetUsed}%`}
              subLabel="of budget used"
            />
            <KPICard
              title="Savings"
              value={formatMoney(savings)}
              icon={PiggyBank}
              color="text-blue-500"
              bgColor="bg-blue-100 dark:bg-blue-900/30"
              sparkData={sparkData.savings}
              sparkColor="#3b82f6"
            />
            <KPICard
              title="Net Balance"
              value={formatMoney(balance)}
              icon={IndianRupee}
              color={balance >= 0 ? 'text-green-500' : 'text-destructive'}
              bgColor={balance >= 0
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-red-100 dark:bg-red-900/30'}
              subValue={totalEMI > 0 ? formatMoney(totalEMI) : null}
              subLabel="total EMI/month"
            />
          </div>

          {/* ── BUDGET HEALTH PANEL ── */}
          {monthlyBudget > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">

              {/* Header strip */}
              <div className={cn(
                'px-6 py-4 flex items-center justify-between border-b',
                isOverBudget
                  ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                  : budgetHealth > 80
                    ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
                    : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center text-xl',
                    isOverBudget ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'
                  )}>
                    {isOverBudget ? '⚠️' : budgetHealth > 80 ? '⚡' : '✅'}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">
                      {isOverBudget
                        ? `Over Budget by ${formatMoney(Math.abs(remaining))}`
                        : budgetHealth > 80
                          ? 'Almost at Budget Limit'
                          : 'Budget On Track'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {daysLeft} days left in this cycle • Daily burn: {formatMoney(Math.round(dailyBurnRate))}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{Math.round(budgetHealth)}%</p>
                  <p className="text-xs text-muted-foreground">of budget used</p>
                </div>
              </div>

              <div className="p-6 space-y-6">

                {/* Stacked progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Budget Usage</span>
                    <span className="font-bold">
                      {formatMoney(totalOutflow)}
                      <span className="text-muted-foreground font-normal"> / {formatMoney(monthlyBudget)}</span>
                    </span>
                  </div>
                  <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                    {/* Expenses */}
                    <div
                      className="absolute left-0 top-0 h-full transition-all duration-700 rounded-l-full"
                      style={{ width: `${Math.min((expense / monthlyBudget) * 100, 100)}%`, backgroundColor: '#ef4444' }}
                    />
                    {/* Debt */}
                    <div
                      className="absolute top-0 h-full transition-all duration-700"
                      style={{
                        left: `${Math.min((expense / monthlyBudget) * 100, 100)}%`,
                        width: `${Math.min((debt / monthlyBudget) * 100, 100 - Math.min((expense / monthlyBudget) * 100, 100))}%`,
                        backgroundColor: '#f97316'
                      }}
                    />
                    {/* Savings */}
                    <div
                      className="absolute top-0 h-full transition-all duration-700"
                      style={{
                        left: `${Math.min(((expense + debt) / monthlyBudget) * 100, 100)}%`,
                        width: `${Math.min((savings / monthlyBudget) * 100, 100 - Math.min(((expense + debt) / monthlyBudget) * 100, 100))}%`,
                        backgroundColor: '#3b82f6'
                      }}
                    />
                    {isOverBudget && (
                      <div className="absolute right-0 top-0 h-full w-2 bg-red-500 animate-pulse" />
                    )}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" />Expenses {formatMoney(expense)}</span>
                    <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-500" />Debt {formatMoney(debt)}</span>
                    <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" />Savings {formatMoney(savings)}</span>
                    <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />Remaining {formatMoney(Math.max(remaining, 0))}</span>
                  </div>
                </div>

                {/* 4 stat boxes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: 'Spent', value: formatMoney(expense), icon: '🛍️',
                      sub: `${monthlyBudget > 0 ? Math.round((expense / monthlyBudget) * 100) : 0}% of budget`,
                      color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-900/30',
                    },
                    {
                      label: 'Saved', value: formatMoney(savings), icon: '🏦',
                      sub: income > 0 ? `${Math.round((savings / income) * 100)}% of income` : '0% of income',
                      color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-900/30',
                    },
                    {
                      label: 'Remaining', value: formatMoney(Math.max(remaining, 0)),
                      icon: isOverBudget ? '🚨' : '💰',
                      sub: isOverBudget ? '⚠️ Over budget!' : `${daysLeft} days to go`,
                      color: isOverBudget ? 'text-destructive' : 'text-green-500',
                      bg: isOverBudget ? 'bg-red-50 dark:bg-red-900/10' : 'bg-green-50 dark:bg-green-900/10',
                      border: isOverBudget ? 'border-red-200 dark:border-red-900/30' : 'border-green-200 dark:border-green-900/30',
                    },
                    {
                      label: 'Projected', value: formatMoney(Math.round(projectedMonthly)), icon: '📊',
                      sub: projectedMonthly > monthlyBudget
                        ? `⚠️ ${formatMoney(Math.round(projectedMonthly - monthlyBudget))} over`
                        : 'On track',
                      color: projectedMonthly > monthlyBudget ? 'text-destructive' : 'text-green-500',
                      bg: projectedMonthly > monthlyBudget ? 'bg-red-50 dark:bg-red-900/10' : 'bg-green-50 dark:bg-green-900/10',
                      border: projectedMonthly > monthlyBudget ? 'border-red-200 dark:border-red-900/30' : 'border-green-200 dark:border-green-900/30',
                    },
                  ].map(stat => (
                    <div key={stat.label} className={cn('rounded-xl border p-4 space-y-1', stat.bg, stat.border)}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                        <span className="text-base">{stat.icon}</span>
                      </div>
                      <p className={cn('text-xl font-bold tracking-tight', stat.color)}>{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Safe-to-spend per day */}
                <div className={cn(
                  'rounded-xl p-4 flex items-center justify-between border',
                  remaining <= 0
                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                    : 'bg-primary/5 border-primary/20'
                )}>
                  <div>
                    <p className="text-sm font-semibold">
                      {remaining <= 0 ? '🚨 You\'ve exceeded your budget' : '💡 Safe to spend per day'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {remaining <= 0
                        ? 'Stop spending — over budget this month'
                        : `Based on ${daysLeft} days remaining in this cycle`}
                    </p>
                  </div>
                  {remaining > 0 && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {formatMoney(Math.round(remaining / Math.max(daysLeft, 1)))}
                      </p>
                      <p className="text-xs text-muted-foreground">per day</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            <AnalyticsWidget
              title="Income Breakdown"
              icon={TrendingUp}
              data={incomeData}
              totalValue={income}
              formatMoney={formatMoney}
              colorClass="text-green-500"
            />
            <AnalyticsWidget
              title="Expense Breakdown"
              icon={TrendingDown}
              data={expenseData}
              totalValue={expense}
              formatMoney={formatMoney}
              colorClass="text-destructive"
            />
          </div>

          {/* Upcoming Expenses */}
          {upcomingExpenses.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-primary" />
                Upcoming This Month
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {upcomingExpenses.map(item => {
                  const daysUntil = Math.ceil((item.dueDate - new Date()) / (1000 * 60 * 60 * 24));
                  const urgent = daysUntil <= 7;
                  return (
                    <div key={item.id} className={cn(
                      'flex items-center justify-between p-3 rounded-xl border',
                      urgent
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                        : 'bg-muted/40 border-transparent'
                    )}>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[110px]">{item.description}</p>
                        <p className={cn('text-xs', urgent ? 'text-red-500 font-bold animate-pulse' : 'text-muted-foreground')}>
                          {urgent ? `${daysUntil}d left!` : format(item.dueDate, 'dd MMM')}
                        </p>
                      </div>
                      <span className="font-bold text-sm">{formatMoney(item.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SPENDING TAB ── */}
      {activeTab === 'spending' && (
        <div className="space-y-6">
          {/* Category budget bars */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Category Budget Tracker
              </h3>
              <span className="text-xs text-muted-foreground">
                Total: <span className="font-bold text-foreground">{formatMoney(expense)}</span>
                {monthlyBudget > 0 && ` / ${formatMoney(monthlyBudget)}`}
              </span>
            </div>
            {expenseCategories.length > 0 ? (
              <div className="space-y-4">
                {expenseCategories.map(cat => (
                  <ProgressBar
                    key={cat.id}
                    label={cat.name}
                    value={cat.spent}
                    max={cat.budget || 0}
                    color={cat.color}
                    formatMoney={formatMoney}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No expenses this month yet.</p>
            )}
          </div>

          {/* Payment mode breakdown */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Payment Mode Breakdown
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { id: 'upi',        label: 'UPI',         emoji: '📱', color: '#8b5cf6' },
                { id: 'cash',       label: 'Cash',        emoji: '💵', color: '#10b981' },
                { id: 'card',       label: 'Card',        emoji: '💳', color: '#3b82f6' },
                { id: 'netbanking', label: 'Net Banking', emoji: '🏦', color: '#f59e0b' },
              ].map(mode => {
                const total = monthlyTx
                  .filter(t => t.type === 'expense' && t.paymentMode === mode.id)
                  .reduce((s, t) => s + t.amount, 0);
                const pct = expense > 0 ? Math.round((total / expense) * 100) : 0;
                return (
                  <div key={mode.id} className="bg-muted/30 rounded-xl p-4 text-center border border-border/50">
                    <div className="text-2xl mb-1">{mode.emoji}</div>
                    <p className="text-xs font-medium text-muted-foreground">{mode.label}</p>
                    <p className="text-base font-bold mt-1">{formatMoney(total)}</p>
                    <p className="text-xs text-muted-foreground">{pct}% of expenses</p>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: mode.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── GOALS TAB ── */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: 'Savings Rate',
                value: Math.max(savingsRate, 0),
                unit: '%',
                desc: 'Target: 20% of income',
                color: '#10b981',
              },
              {
                label: 'Budget Control',
                value: Math.max(0, 100 - budgetUsed),
                unit: '%',
                desc: `${formatMoney(Math.max((monthlyBudget || 0) - expense, 0))} remaining`,
                color: '#3b82f6',
              },
              {
                label: 'Debt Progress',
                value: totalEMI > 0 ? Math.min(Math.round((debt / totalEMI) * 100), 100) : 0,
                unit: '%',
                desc: loans.length > 0
                  ? `${loans.length} active loan${loans.length > 1 ? 's' : ''}`
                  : 'No loans',
                color: '#f59e0b',
              },
            ].map(goal => (
              <div key={goal.label} className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
                <div className="flex justify-center">
                  <CircleProgress
                    percentage={Math.min(Math.max(goal.value, 0), 100)}
                    size={100}
                    strokeWidth={8}
                    color={goal.color}
                  />
                </div>
                <p className="font-semibold mt-3">{goal.label}</p>
                <p className="text-2xl font-bold mt-1">{goal.value}{goal.unit}</p>
                <p className="text-xs text-muted-foreground mt-1">{goal.desc}</p>
              </div>
            ))}
          </div>

          {/* EMI Overview */}
          {loans.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                EMI / Loan Overview
              </h3>
              <div className="space-y-3">
                {loans.map(loan => (
                  <div key={loan.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <div>
                      <p className="font-medium text-sm">{loan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {loan.type === 'emi' ? `${loan.tenure} months tenure` : 'Personal debt'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-orange-500">
                        {formatMoney(loan.monthlyAmount || loan.principal)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {loan.type === 'emi' ? '/month' : 'principal'}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-border text-sm font-semibold">
                  <span>Total EMI/month</span>
                  <span className="text-orange-500">{formatMoney(totalEMI)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default Dashboard;
