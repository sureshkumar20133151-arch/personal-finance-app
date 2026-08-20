
import React, { useState, useMemo, useCallback } from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import { format, subMonths, addMonths, isSameMonth } from 'date-fns';
import {
  ArrowLeft, ArrowRight, TrendingUp, TrendingDown,
  PiggyBank, CreditCard, Calendar, Share2,
  IndianRupee, Activity, Target, Zap, RefreshCw
} from 'lucide-react';
import AnalyticsWidget from '../components/AnalyticsWidget';
import { cn } from '../lib/utils';
import CircleProgress from '../components/CircleProgress';
import CategoryIcon from '../components/CategoryIcon';


// ── Mini sparkline bar chart ──────────────────────────────────────────────────
const SparkBar = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-6">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all duration-500"
          style={{
            height: `${Math.max((v / max) * 100, 4)}%`,
            backgroundColor: color,
            opacity: 0.3 + (i / data.length) * 0.7,
          }}
        />
      ))}
    </div>
  );
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
const KPICard = ({ title, value, subValue, subLabel, icon: Icon, color, bgColor, sparkColor, sparkData, trend, children }) => (
  <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm transition-all duration-250 hover:shadow-lg hover:-translate-y-1 group overflow-hidden relative">
    {/* Subtle gradient overlay on hover */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-primary/3 to-transparent rounded-2xl" />
    <div className="flex items-start justify-between mb-2">
      <div className={cn('p-2.5 rounded-xl transition-all duration-200 group-hover:scale-110 group-hover:shadow-md', bgColor)}>
        <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5', color)} />
      </div>
      {trend !== undefined && trend !== null && (
        <span className={cn(
          'text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full transition-all',
          trend <= 0
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        )}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">{title}</p>
    <p className={cn('text-lg sm:text-xl font-extrabold tracking-tight', color)}>{value}</p>
    {sparkData && (
      <div className="mt-2">
        <SparkBar data={sparkData} color={sparkColor} />
      </div>
    )}
    {subValue && (
      <p className="text-xs text-muted-foreground mt-2">
        <span className="font-semibold text-foreground">{subValue}</span> {subLabel}
      </p>
    )}
    {children}
  </div>
);

// ── Progress bar ──────────────────────────────────────────────────────────────
const ProgressBar = ({ label, value, max, color, formatMoney }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isOver = max > 0 && value > max;
  const barColor = isOver ? '#ef4444' : pct > 80 ? '#f59e0b' : color;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-foreground truncate max-w-[150px]">{label}</span>
        <span className={cn('font-bold', isOver ? 'text-destructive' : pct > 80 ? 'text-amber-500' : 'text-muted-foreground')}>
          {formatMoney(value)}{max > 0 ? ` / ${formatMoney(max)}` : ''}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', isOver && 'pulse-danger')}
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
};

const tourSteps = [
  {
    title: "👋 Welcome to FinTrack!",
    content: "Let's take a quick 1-minute tour to help you understand how to manage your budget and track your expenses.",
    target: null,
  },
  {
    title: "📊 Financial Summary",
    content: "Here you'll see your monthly overview: Income, Expenses, Savings, and Net Balance. It's arranged in a 2x2 grid layout on mobile screens.",
    target: "tour-kpi-cards",
  },
  {
    title: "💡 Safe to Spend Per Day",
    content: "This is your daily budget helper! It divides your remaining budget by the days left in the month to tell you exactly how much is safe to spend today.",
    target: "tour-budget-health",
  },
  {
    title: "🗺️ Simple Tabs Navigation",
    content: "Easily switch tabs to check Category Budget tracking or circular Goal progressions.",
    target: "tour-nav-tabs",
  },
  {
    title: "🚀 You're Ready!",
    content: "Try entering a transaction or use the Demo Mode to play around. Your financial journey starts now!",
    target: null,
  }
];

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const {
    transactions = [], formatMoney, categories = [],
    loans = [], recurring = [], salaryDate, monthlyBudget,
    rescanTransactions,
    bankBalance, cashBalance, totalBalance, bankAccountBalances,
    isSmsUnlocked
  } = useFinanceData();

  const netBalance = totalBalance;
  const bankAccounts = bankAccountBalances;

  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setToast({ show: true, message: 'Syncing SMS & Notifications...', type: 'info' });
    try {
      const result = await rescanTransactions();
      const count = result?.count ?? 0;
      const scanned = result?.totalScanned ?? 0;
      if (count > 0) {
        setToast({ show: true, message: `Sync complete! Scanned ${scanned} SMS. Imported ${count} new transactions.`, type: 'success' });
      } else {
        setToast({ show: true, message: `No new transactions found (scanned ${scanned} SMS).`, type: 'info' });
      }
    } catch (e) {
      console.error('[Dashboard] Rescan error:', e);
      setToast({ show: true, message: 'Sync failed! Please verify SMS and Notification permissions.', type: 'error' });
    }
    setRefreshing(false);
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');

  // Tour Guide State
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [spotlightStyle, setSpotlightStyle] = useState({ display: 'none' });

  // Update spotlight rect dynamically when step changes or window resizes
  const updateSpotlight = useCallback(() => {
    if (!showTour) {
      setSpotlightStyle({ display: 'none' });
      return;
    }
    const step = tourSteps[tourStep];
    if (!step || !step.target) {
      setSpotlightStyle({ display: 'none' });
      return;
    }
    const el = document.getElementById(step.target);
    if (!el) {
      setSpotlightStyle({ display: 'none' });
      return;
    }
    const rect = el.getBoundingClientRect();
    setSpotlightStyle({
      position: 'fixed',
      top: `${rect.top - 8}px`,
      left: `${rect.left - 8}px`,
      width: `${rect.width + 16}px`,
      height: `${rect.height + 16}px`,
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
      borderRadius: '16px',
      transition: 'all 0.3s ease',
      pointerEvents: 'none',
      zIndex: 49,
    });
  }, [showTour, tourStep]);

  React.useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight);
    return () => {
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight);
    };
  }, [updateSpotlight]);

  React.useEffect(() => {
    // Check if tour was completed
    const completed = localStorage.getItem('fintrack_tour_completed');
    if (!completed) {
      const timer = setTimeout(() => {
        setShowTour(true);
        setTourStep(0);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNextStep = () => {
    if (tourStep < tourSteps.length - 1) {
      setTourStep(s => s + 1);
    } else {
      handleSkipTour();
    }
  };

  const handlePrevStep = () => {
    if (tourStep > 0) {
      setTourStep(s => s - 1);
    }
  };

  const handleSkipTour = () => {
    setShowTour(false);
    localStorage.setItem('fintrack_tour_completed', 'true');
  };

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
  
  const monthlyNet = income - expense - debt;

  // Balances and Bank Accounts are now centrally computed in FinanceContext

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

  // Upcoming recurring this month (detailed with categories and next due dates)
  const upcomingExpenses = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return (recurring || [])
      .filter(r => r.active)
      .map(r => {
        const lastRun = r.lastProcessedDate ? new Date(r.lastProcessedDate) : new Date();
        let nextDue = new Date(lastRun);
        if (r.frequency === 'weekly') {
          nextDue.setDate(lastRun.getDate() + 7);
        } else if (r.frequency === 'monthly') {
          nextDue.setMonth(lastRun.getMonth() + 1);
        } else if (r.frequency === 'custom') {
          nextDue.setDate(lastRun.getDate() + (r.interval || 30));
        } else {
          nextDue.setDate(lastRun.getDate() + 1);
        }
        
        while (nextDue < today) {
          if (r.frequency === 'weekly') {
            nextDue.setDate(nextDue.getDate() + 7);
          } else if (r.frequency === 'monthly') {
            nextDue.setMonth(nextDue.getMonth() + 1);
          } else if (r.frequency === 'custom') {
            nextDue.setDate(nextDue.getDate() + (r.interval || 30));
          } else {
            nextDue.setDate(nextDue.getDate() + 1);
          }
        }
        
        const category = categories.find(c => c.id === r.categoryId);
        return { ...r, nextDue, category };
      })
      .sort((a, b) => a.nextDue - b.nextDue)
      .slice(0, 4);
  }, [recurring, categories]);

  // Next single upcoming recurring payment across all frequencies
  const nextRecurringPayment = useMemo(() => {
    const today = new Date();
    const list = (recurring || [])
      .filter(r => r.active)
      .map(r => {
        const lastRun = r.lastProcessedDate ? new Date(r.lastProcessedDate) : new Date();
        let nextDue = new Date(lastRun);
        if (r.frequency === 'weekly') {
          nextDue.setDate(lastRun.getDate() + 7);
        } else if (r.frequency === 'monthly') {
          nextDue.setMonth(lastRun.getMonth() + 1);
        } else if (r.frequency === 'custom') {
          nextDue.setDate(lastRun.getDate() + (r.interval || 30));
        } else {
          nextDue.setDate(lastRun.getDate() + 1);
        }
        
        while (nextDue < today) {
          if (r.frequency === 'weekly') {
            nextDue.setDate(nextDue.getDate() + 7);
          } else if (r.frequency === 'monthly') {
            nextDue.setMonth(nextDue.getMonth() + 1);
          } else if (r.frequency === 'custom') {
            nextDue.setDate(nextDue.getDate() + (r.interval || 30));
          } else {
            nextDue.setDate(nextDue.getDate() + 1);
          }
        }
        
        return { ...r, nextDue };
      })
      .sort((a, b) => a.nextDue - b.nextDue);
    return list[0] || null;
  }, [recurring]);


  const totalEMI    = useMemo(() => loans.reduce((s, l) => s + (l.monthlyAmount || 0), 0), [loans]);
  const savingsRate = income > 0 ? Math.round((monthlyNet / income) * 100) : 0;
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

  // ── Smart AI Insights & Health Score Computation ──────────────────────────
  const healthScore = useMemo(() => {
    let score = 75;
    if (savingsRate >= 20) score += 15;
    else if (savingsRate >= 10) score += 8;
    else if (savingsRate < 0) score -= 15;

    if (monthlyBudget > 0) {
      if (budgetUsed <= 80) score += 10;
      else if (budgetUsed > 100) score -= 25;
      else score -= 10;

      if (projectedMonthly <= monthlyBudget) score += 10;
      else score -= 15;
    }

    return Math.max(15, Math.min(100, Math.round(score)));
  }, [savingsRate, monthlyBudget, budgetUsed, projectedMonthly]);

  const smartInsights = useMemo(() => {
    const list = [];
    const topExp = expenseData[0];

    // 1. Pacing & Budget Trajectory
    if (monthlyBudget > 0) {
      if (isOverBudget) {
        list.push({
          icon: '🚨',
          title: 'Over Budget Deficit',
          text: `Exceeded budget by ${formatMoney(Math.abs(remaining))}. Pause discretionary spending!`,
          color: 'text-red-500 dark:text-red-400',
          bg: 'bg-red-500/10 border-red-500/20'
        });
      } else if (projectedMonthly > monthlyBudget) {
        const diff = projectedMonthly - monthlyBudget;
        list.push({
          icon: '⚠️',
          title: 'High Burn Rate Warning',
          text: `At ₹${Math.round(dailyBurnRate)}/day, you're projected to end ₹${formatMoney(Math.round(diff))} over budget.`,
          color: 'text-amber-500 dark:text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/20'
        });
      } else {
        list.push({
          icon: '💡',
          title: 'Safe Daily Spending Pace',
          text: `Safe to spend ${formatMoney(Math.round(remaining / Math.max(daysLeft, 1)))} per day for the next ${daysLeft} days.`,
          color: 'text-green-500 dark:text-green-400',
          bg: 'bg-green-500/10 border-green-500/20'
        });
      }
    } else {
      list.push({
        icon: '🎯',
        title: 'Monthly Budget Tip',
        text: 'Set a monthly budget in Setup to get real-time spend pacing alerts and daily limits!',
        color: 'text-primary',
        bg: 'bg-primary/10 border-primary/20'
      });
    }

    // 2. Top Expense Category
    if (topExp && topExp.value > 0) {
      const pct = expense > 0 ? Math.round((topExp.value / expense) * 100) : 0;
      list.push({
        icon: '🏷️',
        title: `Top Spend: ${topExp.name}`,
        text: `${topExp.name} accounts for ${pct}% of your total expenses (${formatMoney(topExp.value)}).`,
        color: 'text-blue-500 dark:text-blue-400',
        bg: 'bg-blue-500/10 border-blue-500/20'
      });
    }

    // 3. Savings & Wealth Rate
    if (income > 0) {
      if (savingsRate >= 20) {
        list.push({
          icon: '🌟',
          title: 'Strong Savings Velocity',
          text: `Saving ${savingsRate}% of income! Excellent progress towards financial independence.`,
          color: 'text-emerald-500 dark:text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/20'
        });
      } else if (savingsRate > 0) {
        list.push({
          icon: '🏦',
          title: 'Positive Net Savings',
          text: `Currently saving ${savingsRate}% of income (${formatMoney(monthlyNet)}). Target 20%+ to boost wealth.`,
          color: 'text-indigo-500 dark:text-indigo-400',
          bg: 'bg-indigo-500/10 border-indigo-500/20'
        });
      } else {
        list.push({
          icon: '📉',
          title: 'Negative Cash Flow Alert',
          text: `Outflow exceeds income by ${formatMoney(Math.abs(monthlyNet))}. Review optional expenses.`,
          color: 'text-red-500 dark:text-red-400',
          bg: 'bg-red-500/10 border-red-500/20'
        });
      }
    } else {
      list.push({
        icon: '📊',
        title: 'Monthly Income Tracking',
        text: 'Add your salary or income entries to calculate your net savings rate.',
        color: 'text-purple-500 dark:text-purple-400',
        bg: 'bg-purple-500/10 border-purple-500/20'
      });
    }

    return list;
  }, [monthlyBudget, isOverBudget, remaining, projectedMonthly, dailyBurnRate, daysLeft, formatMoney, expenseData, expense, income, savingsRate, monthlyNet]);

  const previousMonth = () => setCurrentDate(d => subMonths(d, 1));
  const nextMonth     = () => setCurrentDate(d => addMonths(d, 1));

  const handleShare = useCallback(() => {
    const monthName = format(currentDate, 'MMMM yyyy');
    const top = expenseData[0];
    const rate = income > 0 ? Math.round((monthlyNet / income) * 100) : 0;
    const message =
      `💰 *${monthName} Financial Summary*\n\n` +
      `✅ Income: ${formatMoney(income)}\n` +
      `🛒 Expenses: ${formatMoney(expense)}\n` +
      `📈 Savings: ${formatMoney(savings)}\n` +
      `💳 Debt Paid: ${formatMoney(debt)}\n` +
      `🏦 Net Balance: ${formatMoney(netBalance)}\n\n` +
      `📊 Savings Rate: ${rate}%\n` +
      (top ? `🔺 Top Spend: ${top.name} (${formatMoney(top.value)})\n` : '') +
      `\n_Tracked with BudgetTracker_ 🇮🇳`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  }, [currentDate, income, expense, savings, debt, netBalance, expenseData, formatMoney, monthlyNet]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {format(monthStart, 'dd MMM')} – {format(monthEnd, 'dd MMM yyyy')}
            </p>
          </div>

          {/* ── Tab Nav ── */}
          <div id="tour-nav-tabs" className="flex gap-1 p-1 bg-muted/50 rounded-xl w-fit">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'spending', label: 'Spending', icon: TrendingDown },
              { id: 'goals',    label: 'Goals',    icon: Target },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all',
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
          {isSmsUnlocked && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              title="Refresh transactions"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              <span className="hidden sm:inline">Sync SMS</span>
            </button>
          )}
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

      {/* ── Bank Accounts Quick Cards ── */}
      {bankAccounts.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x">
          {bankAccounts.map((acc, index) => (
            <div 
              key={index} 
              className={cn(
                "flex-shrink-0 w-52 rounded-2xl border p-4 shadow-sm snap-start transition-all relative overflow-hidden",
                "bg-gradient-to-br from-card to-muted/10 border-border hover:shadow-md"
              )}
            >
              <div 
                className="absolute -right-8 -top-8 w-24 h-24 rounded-full opacity-10 blur-xl animate-pulse"
                style={{
                  backgroundColor: 
                    acc.bankName === 'Indian Bank' ? '#1d4ed8' : 
                    acc.bankName === 'Canara Bank' ? '#0d9488' : 
                    acc.bankName === 'SBI' ? '#0284c7' : '#8b5cf6'
                }}
              />
              
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    {acc.bankName}
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-0.5 font-medium">
                    A/c •••• {acc.accountEnding}
                  </p>
                </div>
                <span className="text-lg">
                  {acc.bankName === 'Indian Bank' ? '🔵' : 
                   acc.bankName === 'Canara Bank' ? '🟢' : 
                   acc.bankName === 'SBI' ? '🔷' : '🏦'}
                </span>
              </div>
              
              <div className="mt-4 flex justify-between items-end">
                <div>
                  <p className="text-2xl font-bold tracking-tight leading-none">
                    {formatMoney(acc.balance)}
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-1.5 font-medium">
                    {acc.transactionCount} transactions
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* ── SMART AI FINANCIAL DIGEST BANNER ── */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-background p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold shadow-inner">
                  ✨
                </div>
                <div>
                  <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                    Smart Financial Pulse
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                      Auto Digest
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">Automated real-time insights based on your monthly spending pacing & income</p>
                </div>
              </div>

              {/* Health Score Badge */}
              <div className="flex items-center gap-3 bg-background/80 px-3.5 py-1.5 rounded-xl border border-border shrink-0 self-start sm:self-auto">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Financial Health Index</p>
                  <p className={cn(
                    "text-base font-black",
                    healthScore >= 80 ? "text-green-500" : healthScore >= 60 ? "text-amber-500" : "text-red-500"
                  )}>
                    {healthScore}/100 • {healthScore >= 80 ? "Excellent 🟢" : healthScore >= 60 ? "Solid 🟡" : "Needs Care 🔴"}
                  </p>
                </div>
              </div>
            </div>

            {/* 3 Smart Insight Cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              {smartInsights.map((insight, idx) => (
                <div key={idx} className={cn("p-3 rounded-xl border flex items-start gap-2.5 transition-all hover:scale-[1.01]", insight.bg)}>
                  <span className="text-lg shrink-0 mt-0.5">{insight.icon}</span>
                  <div className="min-w-0">
                    <p className={cn("text-xs font-bold truncate", insight.color)}>
                      {insight.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {insight.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Next Recurring Payment Banner */}
          {nextRecurringPayment && (() => {
            const daysUntil = Math.ceil((nextRecurringPayment.nextDue - new Date()) / (1000 * 60 * 60 * 24));
            const urgent = daysUntil <= 7;
            return (
              <div className={cn(
                "rounded-2xl border p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300 shadow-sm",
                urgent 
                  ? "bg-gradient-to-r from-red-500/10 to-amber-500/5 border-red-500/20" 
                  : "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner",
                    urgent ? "bg-red-500/20 text-red-500" : "bg-primary/20 text-primary"
                  )}>
                    🔄
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground">{nextRecurringPayment.description}</p>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize",
                        urgent ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse" : "bg-primary/20 text-primary"
                      )}>
                        {nextRecurringPayment.frequency}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Next billing date: <span className="font-semibold text-foreground">{format(nextRecurringPayment.nextDue, 'dd MMMM yyyy')}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-muted-foreground">Amount Due</p>
                    <p className="text-lg font-extrabold text-foreground">{formatMoney(nextRecurringPayment.amount)}</p>
                  </div>
                  <span className={cn(
                    "text-xs font-bold px-3 py-1.5 rounded-xl border shadow-sm",
                    urgent 
                      ? "bg-red-500 text-white border-transparent" 
                      : "bg-card text-foreground border-border"
                  )}>
                    {daysUntil <= 0 ? "Due today!" : `In ${daysUntil} days`}
                  </span>
                </div>
              </div>
            );
          })()}


          {/* KPI Cards */}
          <div id="tour-kpi-cards" className="grid gap-3 grid-cols-2 lg:grid-cols-4">
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
              value={formatMoney(netBalance)}
              icon={IndianRupee}
              color={netBalance >= 0 ? 'text-green-500' : 'text-destructive'}
              bgColor={netBalance >= 0
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-red-100 dark:bg-red-900/30'}
              subValue={totalEMI > 0 ? formatMoney(totalEMI) : null}
              subLabel="total EMI/month"
            >
              <div className="mt-3 pt-3 border-t border-border/50 space-y-1 text-[11px] sm:text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="flex items-center gap-1">🏦 Bank Balance:</span>
                  <span className="font-semibold text-foreground">{formatMoney(bankBalance)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="flex items-center gap-1">💵 Cash in Hand:</span>
                  <span className="font-semibold text-foreground">{formatMoney(cashBalance)}</span>
                </div>
              </div>
            </KPICard>
          </div>

          {/* ── BUDGET HEALTH & UPCOMING BILLS ROW (SIDE-BY-SIDE) ── */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 items-stretch">

            {/* ── BUDGET HEALTH PANEL (2 Cols) ── */}
            {monthlyBudget > 0 && (
              <div id="tour-budget-health" className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col justify-between">

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

                <div className="p-6 space-y-6 flex-1 flex flex-col justify-between">

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
                      <div key={stat.label} className={cn('rounded-xl border p-3 sm:p-4 space-y-1', stat.bg, stat.border)}>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                          <span className="text-base">{stat.icon}</span>
                        </div>
                        <p className={cn('text-sm sm:text-lg font-bold tracking-tight', stat.color)}>{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Safe-to-spend per day */}
                  <div className={cn(
                    'rounded-xl p-3 sm:p-4 flex items-center justify-between border',
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

            {/* ── UPCOMING RECURRING PAYMENTS (1 Col on Right) ── */}
            <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between", monthlyBudget > 0 ? "lg:col-span-1" : "lg:col-span-3")}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Upcoming Bills
                  </h3>
                  {upcomingExpenses.length > 0 && (
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                      {upcomingExpenses.length} due
                    </span>
                  )}
                </div>
                
                {upcomingExpenses.length > 0 ? (
                  <div className="space-y-2.5">
                    {upcomingExpenses.map(item => {
                      const daysUntil = Math.ceil((item.nextDue - new Date()) / (1000 * 60 * 60 * 24));
                      const urgent = daysUntil <= 7;
                      const cat = item.category || { name: 'Uncategorized', color: '#64748b', icon: 'HelpCircle' };
                      
                      return (
                        <div 
                          key={item.id} 
                          className={cn(
                            'flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 hover:shadow-md bg-background/50',
                            urgent
                              ? 'bg-red-500/5 border-red-500/20'
                              : 'bg-muted/10 border-border/80'
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center border shadow-inner shrink-0 bg-background"
                              style={{ borderColor: `${cat.color}25` }}
                            >
                              <CategoryIcon iconName={cat.icon || cat.emoji} size={14} color={cat.color} />
                            </div>
                            
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate text-foreground flex items-center gap-1">
                                {item.description || cat.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                <span>📅 {format(item.nextDue, 'dd MMM')}</span>
                                <span className="capitalize text-[9px] text-muted-foreground/80">({item.frequency})</span>
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <p className="text-xs font-extrabold text-red-500">-{formatMoney(item.amount)}</p>
                            <span className={cn(
                              "inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5",
                              urgent 
                                ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 animate-pulse" 
                                : "bg-muted text-muted-foreground"
                            )}>
                              {daysUntil <= 0 ? "Due today!" : `${daysUntil}d left`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-border rounded-xl bg-muted/5 p-4 my-auto">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">No upcoming bills</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-normal max-w-xs">
                      Add subscriptions in <strong>Transactions</strong> & check <strong>"Recurring Expense"</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

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
      {/* ── ONBOARDING GUIDE TOUR OVERLAY ── */}
      {showTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Background Dim overlay if no target spotlight is active */}
          {tourSteps[tourStep].target === null && (
            <div 
              className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300"
              onClick={handleSkipTour}
            />
          )}

          {/* Spotlight Element */}
          {tourSteps[tourStep].target !== null && (
            <>
              {/* Invisible blocker to capture clicks outside target */}
              <div 
                className="fixed inset-0 bg-transparent"
                onClick={handleSkipTour}
              />
              <div style={spotlightStyle} />
            </>
          )}

          {/* Guide Dialog Box */}
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 flex flex-col gap-4">
            {/* Step Indicator */}
            <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              <span>Guide Tour</span>
              <span>{tourStep + 1} of {tourSteps.length}</span>
            </div>

            {/* Title & Body */}
            <div className="space-y-2">
              <h4 className="text-base font-bold text-foreground">{tourSteps[tourStep].title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{tourSteps[tourStep].content}</p>
            </div>

            {/* Progress dot indicators */}
            <div className="flex gap-1.5 justify-center py-1">
              {tourSteps.map((_, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    idx === tourStep ? "w-6 bg-primary" : "w-1 bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/55">
              <button 
                onClick={handleSkipTour} 
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
              <div className="flex gap-2">
                {tourStep > 0 && (
                  <button 
                    onClick={handlePrevStep}
                    className="px-3 py-1.5 rounded-xl border border-input text-xs font-semibold hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    Back
                  </button>
                )}
                <button 
                  onClick={handleNextStep}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 shadow-sm transition-colors"
                >
                  {tourStep === tourSteps.length - 1 ? 'Get Started' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-background border border-border px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 max-w-[90%] transition-all duration-300 border-primary/20 shadow-primary/10">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
            toast.type === 'success' ? 'bg-green-500/20 text-green-500' :
            toast.type === 'error' ? 'bg-red-500/20 text-red-500' :
            'bg-primary/20 text-primary'
          )}>
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
          </div>
          <div className="text-xs sm:text-sm font-semibold text-foreground">
            {toast.message}
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
