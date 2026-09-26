
import React, { useState, useMemo, useCallback } from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import { format, subMonths, addMonths, isSameMonth } from 'date-fns';
import {
  ArrowLeft, ArrowRight, TrendingUp, TrendingDown,
  PiggyBank, CreditCard, Calendar, Share2,
  IndianRupee, Activity, Target, Zap, RefreshCw,
  Users, Scale, Heart
} from 'lucide-react';
import AnalyticsWidget from '../components/AnalyticsWidget';
import { cn } from '../lib/utils';
import CircleProgress from '../components/CircleProgress';
import CategoryIcon from '../components/CategoryIcon';
import SalaryPocketSystem, { DeferredPaymentsPanel } from '../components/SalaryPocketSystem';


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
    content: "Add your first transaction, set your monthly budget, or scan bank SMS. Your financial journey starts now!",
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
    isSmsUnlocked, isPro,
    householdId, currentActorName,
    monthlySalary, salaryPockets, savingsPool,
    updateSalaryPockets, addToSavingsPool, markDeferredAsPaid,
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

  // ── Household Spend Analysis (Feature 7) ──────────────────────────────────
  const householdSpend = useMemo(() => {
    const expenses = monthlyTx.filter(t => t.type === 'expense');
    const totalExp = expenses.reduce((s, t) => s + (t.amount || 0), 0);

    let sureshTotal = 0;
    let sureshJoint = 0;
    let sureshPersonal = 0;
    let sureshCount = 0;

    let rosyTotal = 0;
    let rosyJoint = 0;
    let rosyPersonal = 0;
    let rosyCount = 0;

    let claudeTotal = 0;
    let claudeCount = 0;

    let jointTotal = 0;
    let personalTotal = 0;

    expenses.forEach(t => {
      const amt = Number(t.amount) || 0;
      const creator = (t.createdBy || '').toLowerCase();
      const updator = (t.updatedBy || '').toLowerCase();
      const scope = t.scope || 'ours';

      const isRosy = creator.includes('rosy') || updator.includes('rosy') || creator === 'do139v31skrxmspkli1ar0a9zo2';
      const isClaude = creator.includes('claude') || updator.includes('claude');

      if (isRosy) {
        rosyTotal += amt;
        rosyCount++;
        if (scope === 'ours') rosyJoint += amt;
        else rosyPersonal += amt;
      } else if (isClaude) {
        claudeTotal += amt;
        claudeCount++;
      } else {
        sureshTotal += amt;
        sureshCount++;
        if (scope === 'ours') sureshJoint += amt;
        else sureshPersonal += amt;
      }

      if (scope === 'mine' || scope === 'partner') {
        personalTotal += amt;
      } else {
        jointTotal += amt;
      }
    });

    const sureshPct = totalExp > 0 ? Math.round((sureshTotal / totalExp) * 100) : 0;
    const rosyPct   = totalExp > 0 ? Math.round((rosyTotal / totalExp) * 100) : 0;
    const claudePct = totalExp > 0 ? Math.round((claudeTotal / totalExp) * 100) : 0;
    const jointPct  = totalExp > 0 ? Math.round((jointTotal / totalExp) * 100) : 0;
    const personalPct = totalExp > 0 ? Math.round((personalTotal / totalExp) * 100) : 0;

    const diff = Math.abs(sureshTotal - rosyTotal);
    const higherSpender = sureshTotal >= rosyTotal ? 'Suresh' : 'Rosy';
    const lowerSpender = sureshTotal >= rosyTotal ? 'Rosy' : 'Suresh';

    const jointDiff = Math.abs(sureshJoint - rosyJoint);
    const jointHigher = sureshJoint >= rosyJoint ? 'Suresh' : 'Rosy';
    const jointLower = sureshJoint >= rosyJoint ? 'Rosy' : 'Suresh';
    const settlementAmt = Math.round(jointDiff / 2);

    return {
      totalExp,
      sureshTotal,
      sureshJoint,
      sureshPersonal,
      sureshCount,
      sureshPct,
      rosyTotal,
      rosyJoint,
      rosyPersonal,
      rosyCount,
      rosyPct,
      claudeTotal,
      claudeCount,
      claudePct,
      jointTotal,
      jointPct,
      personalTotal,
      personalPct,
      diff,
      higherSpender,
      lowerSpender,
      jointDiff,
      jointHigher,
      jointLower,
      settlementAmt,
      txCount: expenses.length,
      hasRosyOrTeam: rosyTotal > 0 || claudeTotal > 0 || Boolean(householdId),
    };
  }, [monthlyTx, householdId]);

  const handleHouseholdShare = useCallback(() => {
    const monthName = format(currentDate, 'MMMM yyyy');
    const { totalExp, sureshTotal, sureshPct, rosyTotal, rosyPct, claudeTotal, claudePct, jointTotal, personalTotal, diff, higherSpender, settlementAmt, jointHigher, jointLower } = householdSpend;

    let msg = `🏠 *FinTrack Household Report — ${monthName}*\n\n`;
    msg += `💳 *Total Household Spend:* ${formatMoney(totalExp)}\n\n`;
    msg += `👤 *Suresh:* ${formatMoney(sureshTotal)} (${sureshPct}%)\n`;
    msg += `🌸 *Rosy:* ${formatMoney(rosyTotal)} (${rosyPct}%)\n`;
    if (claudeTotal > 0) {
      msg += `🤖 *Claude MCP:* ${formatMoney(claudeTotal)} (${claudePct}%)\n`;
    }
    msg += `\n🏠 *Joint (Ours):* ${formatMoney(jointTotal)}\n`;
    msg += `👤 *Personal (Mine):* ${formatMoney(personalTotal)}\n\n`;

    if (sureshTotal > 0 && rosyTotal > 0) {
      if (diff === 0) {
        msg += `⚖️ *Split Status:* Perfectly balanced 50/50 contribution!\n`;
      } else {
        msg += `⚖️ *Overall:* ${higherSpender} contributed ${formatMoney(diff)} more this month.\n`;
        if (settlementAmt > 0) {
          msg += `🤝 *Joint 50/50 Settlement:* ${jointLower} can transfer ${formatMoney(settlementAmt)} to ${jointHigher}.\n`;
        }
      }
    }
    msg += `\n_Generated by FinTrack Budget Tracker_ 💑`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }, [currentDate, householdSpend, formatMoney]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Title + month selector */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">💰 FinTrack</h1>
            <p className="text-[11px] text-muted-foreground">{format(monthStart, 'dd MMM')} – {format(monthEnd, 'dd MMM yyyy')}</p>
          </div>
        </div>

        {/* Right: month nav + actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-0.5 bg-muted/60 border border-border/50 rounded-xl px-1 py-1">
            <button onClick={previousMonth} className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted-foreground">
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-xs font-bold min-w-[76px] text-center text-foreground">{format(currentDate, 'MMM yyyy')}</span>
            <button onClick={nextMonth} disabled={isSameMonth(currentDate, new Date())} className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted-foreground disabled:opacity-30">
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {isSmsUnlocked && (
            <button onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          )}
          <button onClick={handleShare}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-2.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-green-500/30">
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* ── HERO BALANCE CARD (Glassmorphism, CRED-style) ── */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700" />
        {/* Glass noise overlay */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        {/* Glow orbs */}
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-purple-400/30 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-blue-400/20 blur-2xl" />

        <div className="relative p-5 sm:p-7">
          {/* Total balance */}
          <div className="mb-5">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Total Balance</p>
            <p className="text-white text-4xl sm:text-5xl font-extrabold tracking-tight leading-none">
              {formatMoney(netBalance)}
            </p>
            {expenseTrend !== null && (
              <span className={cn(
                'inline-flex items-center gap-1 mt-2 text-[11px] font-bold px-2.5 py-1 rounded-full',
                expenseTrend <= 0
                  ? 'bg-emerald-400/25 text-emerald-200'
                  : 'bg-red-400/25 text-red-200'
              )}>
                {expenseTrend > 0 ? '↑' : '↓'} {Math.abs(expenseTrend)}% vs last month
              </span>
            )}
          </div>

          {/* 3 stat pills */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Income', value: income, icon: '💚', color: 'from-emerald-400/20 to-emerald-400/10', border: 'border-emerald-400/30' },
              { label: 'Spent',  value: expense, icon: '🔴', color: 'from-red-400/20 to-red-400/10',     border: 'border-red-400/30' },
              { label: 'Saved',  value: savings, icon: '💙', color: 'from-blue-400/20 to-blue-400/10',   border: 'border-blue-400/30' },
            ].map(stat => (
              <div key={stat.label} className={cn('rounded-2xl border p-3 sm:p-4 bg-gradient-to-br backdrop-blur-sm', stat.color, stat.border)}>
                <p className="text-white/60 text-[10px] sm:text-xs font-semibold uppercase tracking-wide">{stat.label}</p>
                <p className="text-white text-sm sm:text-lg font-extrabold tracking-tight mt-0.5 truncate">{formatMoney(stat.value)}</p>
              </div>
            ))}
          </div>

          {/* Budget progress bar */}
          {monthlyBudget > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex justify-between text-white/70 text-[10px] font-semibold mb-1.5">
                <span>Budget: {formatMoney(expense)} / {formatMoney(monthlyBudget)}</span>
                <span className={budgetUsed > 100 ? 'text-red-300' : budgetUsed > 80 ? 'text-amber-300' : 'text-emerald-300'}>
                  {budgetUsed}% used
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(budgetUsed, 100)}%`,
                    backgroundColor: budgetUsed > 100 ? '#f87171' : budgetUsed > 80 ? '#fbbf24' : '#34d399'
                  }}
                />
              </div>
              {!isOverBudget && daysLeft > 0 && (
                <p className="text-white/50 text-[10px] mt-1.5">
                  💡 Safe to spend <span className="text-white font-bold">{formatMoney(Math.round(Math.max(monthlyBudget - expense, 0) / daysLeft))}/day</span> for {daysLeft} more days
                </p>
              )}
              {isOverBudget && (
                <p className="text-red-300 text-[10px] mt-1.5 font-bold">🚨 Over budget by {formatMoney(Math.abs(monthlyBudget - expense))}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── BANK ACCOUNTS (horizontal scroll, compact) ── */}
      {bankAccounts.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x">
          {bankAccounts.map((acc, index) => {
            const bankColor =
              acc.bankName === 'Indian Bank' ? { from: '#1d4ed8', to: '#3b82f6' } :
              acc.bankName === 'Canara Bank' ? { from: '#0f766e', to: '#14b8a6' } :
              acc.bankName === 'SBI'         ? { from: '#0369a1', to: '#0ea5e9' } :
                                               { from: '#7c3aed', to: '#a78bfa' };
            return (
              <div key={index} className="flex-shrink-0 snap-start rounded-2xl border border-border/60 p-3.5 sm:p-4 w-44 sm:w-52 bg-card shadow-sm relative overflow-hidden hover:shadow-md transition-all">
                <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full opacity-10 blur-xl"
                  style={{ background: `linear-gradient(to br, ${bankColor.from}, ${bankColor.to})` }} />
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate max-w-[100px]">{acc.bankName}</span>
                  <span className="text-base">
                    {acc.bankName === 'Indian Bank' ? '🔵' : acc.bankName === 'Canara Bank' ? '🟢' : acc.bankName === 'SBI' ? '🔷' : '🏦'}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mb-2">•••• {acc.accountEnding}</p>
                <p className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">{formatMoney(acc.balance)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{acc.transactionCount} txns</p>
              </div>
            );
          })}
          {/* Cash card */}
          {cashBalance > 0 && (
            <div className="flex-shrink-0 snap-start rounded-2xl border border-emerald-500/30 p-3.5 sm:p-4 w-44 sm:w-52 bg-emerald-500/5 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cash</span>
                <span className="text-base">💵</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mb-2">In Hand</p>
              <p className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">{formatMoney(cashBalance)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB NAV ── */}
      <div id="tour-nav-tabs" className="flex gap-1 p-1 bg-muted/60 rounded-2xl border border-border/40 w-full sm:w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'spending', label: 'Spending', icon: TrendingDown },
          { id: 'goals',    label: 'Goals',    icon: Target },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center justify-center gap-1.5 flex-1 sm:flex-none sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all',
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm border border-border/40'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">

          {/* Salary Pocket System */}
          <SalaryPocketSystem
            monthlySalary={monthlySalary}
            salaryPockets={salaryPockets}
            transactions={transactions}
            currentMonth={currentDate}
            formatMoney={formatMoney}
            onUpdateSalaryPockets={updateSalaryPockets}
            onTransferToSavings={(amt) => addToSavingsPool(amt, 'salary_remainder')}
          />

          {/* Deferred Payments Panel */}
          <DeferredPaymentsPanel
            transactions={transactions}
            onMarkPaid={markDeferredAsPaid}
            formatMoney={formatMoney}
          />

          {/* ── SMART INSIGHTS ROW ── */}
          <div className="grid gap-3 sm:grid-cols-3">
            {smartInsights.map((insight, i) => (
              <div key={i} className={cn('rounded-2xl border p-4 flex gap-3 items-start', insight.bg)}>
                <span className="text-xl flex-shrink-0 mt-0.5">{insight.icon}</span>
                <div className="min-w-0">
                  <p className={cn('text-xs font-bold mb-0.5 truncate', insight.color)}>{insight.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── KPI CARDS (4 compact cards) ── */}
          <div id="tour-kpi-cards" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Income',      value: income,   icon: TrendingUp,   color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', bar: sparkData.income,  barColor: '#10b981', sub: `${savingsRate}% saved` },
              { label: 'Expenses',    value: expense,  icon: TrendingDown, color: 'text-red-500',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     bar: sparkData.expense, barColor: '#ef4444', sub: `${budgetUsed}% of budget` },
              { label: 'Savings',     value: savings,  icon: PiggyBank,    color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    bar: sparkData.savings, barColor: '#3b82f6', sub: `${income > 0 ? Math.round((savings/income)*100) : 0}% of income` },
              { label: 'Debt Paid',   value: debt,     icon: CreditCard,   color: 'text-orange-500',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  bar: sparkData.debt,    barColor: '#f97316', sub: `${loans.length} loan${loans.length !== 1 ? 's' : ''}` },
            ].map(card => (
              <div key={card.label} className={cn('rounded-2xl border p-3.5 sm:p-4 bg-card shadow-sm hover:shadow-md transition-all relative overflow-hidden', card.border)}>
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-2.5', card.bg)}>
                  <card.icon className={cn('w-4 h-4', card.color)} />
                </div>
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">{card.label}</p>
                <p className={cn('text-base sm:text-lg font-extrabold mt-0.5 tracking-tight', card.color)}>{formatMoney(card.value)}</p>
                {card.bar && <SparkBar data={card.bar} color={card.barColor} />}
                <p className="text-[10px] text-muted-foreground mt-1.5">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* ── NEXT RECURRING BILL BANNER ── */}
          {nextRecurringPayment && (() => {
            const daysUntil = Math.ceil((nextRecurringPayment.nextDue - new Date()) / (1000 * 60 * 60 * 24));
            const urgent = daysUntil <= 7;
            return (
              <div className={cn(
                'rounded-2xl border p-4 flex items-center justify-between gap-4',
                urgent ? 'bg-red-500/8 border-red-500/30' : 'bg-primary/5 border-primary/20'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-lg', urgent ? 'bg-red-500/15' : 'bg-primary/10')}>🔄</div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{nextRecurringPayment.description}</p>
                    <p className="text-xs text-muted-foreground">Due: {format(nextRecurringPayment.nextDue, 'dd MMM yyyy')}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-extrabold text-foreground">{formatMoney(nextRecurringPayment.amount)}</p>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', urgent ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 animate-pulse' : 'bg-primary/10 text-primary')}>
                    {daysUntil <= 0 ? 'Due today!' : `In ${daysUntil}d`}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* ── CHARTS: Expense Breakdown + Upcoming Bills (side by side on desktop) ── */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Expense + Income charts */}
            <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
              <AnalyticsWidget
                title="Expense Breakdown"
                icon={TrendingDown}
                data={expenseData}
                totalValue={expense}
                formatMoney={formatMoney}
                colorClass="text-destructive"
              />
              <AnalyticsWidget
                title="Income Sources"
                icon={TrendingUp}
                data={incomeData}
                totalValue={income}
                formatMoney={formatMoney}
                colorClass="text-emerald-500"
              />
            </div>

            {/* Upcoming Bills */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Upcoming Bills
                </h3>
                {upcomingExpenses.length > 0 && (
                  <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">
                    {upcomingExpenses.length} due
                  </span>
                )}
              </div>
              {upcomingExpenses.length > 0 ? (
                <div className="space-y-2">
                  {upcomingExpenses.map(item => {
                    const daysUntil = Math.ceil((item.nextDue - new Date()) / (1000 * 60 * 60 * 24));
                    const urgent = daysUntil <= 7;
                    const cat = item.category || { name: 'Uncategorized', color: '#64748b', icon: 'HelpCircle' };
                    return (
                      <div key={item.id} className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl border',
                        urgent ? 'bg-red-500/5 border-red-500/20' : 'bg-muted/20 border-border/50'
                      )}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-background border border-border/60 shrink-0">
                            <CategoryIcon iconName={cat.icon || cat.emoji} size={13} color={cat.color} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{item.description || cat.name}</p>
                            <p className="text-[10px] text-muted-foreground">{format(item.nextDue, 'dd MMM')}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-red-500">-{formatMoney(item.amount)}</p>
                          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', urgent ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 animate-pulse' : 'bg-muted text-muted-foreground')}>
                            {daysUntil <= 0 ? 'Today!' : `${daysUntil}d`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <Calendar className="w-5 h-5 text-primary/50" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">No upcoming bills</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Set recurring transactions to track due dates</p>
                </div>
              )}
            </div>
          </div>

          {/* ── HOUSEHOLD REPORT CARD ── */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Header bar with gradient accent */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-rose-500/10 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-rose-500/20 border border-primary/20 flex items-center justify-center text-lg">💑</div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Household Report</h3>
                  <p className="text-[10px] text-muted-foreground">Suresh vs Rosy · {format(currentDate, 'MMM yyyy')}</p>
                </div>
              </div>
              <button onClick={handleHouseholdShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm transition-all">
                <Share2 className="w-3 h-3" /> Share
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Contribution bar */}
              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1.5">
                  <span className="text-muted-foreground">Monthly Contribution</span>
                  <span className="text-foreground font-bold">Total: {formatMoney(householdSpend.totalExp)}</span>
                </div>
                {householdSpend.totalExp > 0 ? (
                  <div className="h-3 bg-muted/60 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                    {householdSpend.sureshTotal > 0 && (
                      <div className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full"
                        style={{ width: `${Math.max(householdSpend.sureshPct, 4)}%` }}
                        title={`Suresh: ${householdSpend.sureshPct}%`} />
                    )}
                    {householdSpend.rosyTotal > 0 && (
                      <div className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full"
                        style={{ width: `${Math.max(householdSpend.rosyPct, 4)}%` }}
                        title={`Rosy: ${householdSpend.rosyPct}%`} />
                    )}
                    {householdSpend.claudeTotal > 0 && (
                      <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                        style={{ width: `${Math.max(householdSpend.claudePct, 4)}%` }} />
                    )}
                  </div>
                ) : (
                  <div className="h-3 bg-muted/40 rounded-full" />
                )}
                <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-semibold">
                  <span className="flex items-center gap-1 text-blue-500"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Suresh {householdSpend.sureshPct}%</span>
                  <span className="flex items-center gap-1 text-rose-500"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Rosy {householdSpend.rosyPct}%</span>
                  {householdSpend.claudeTotal > 0 && <span className="flex items-center gap-1 text-purple-500"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Claude {householdSpend.claudePct}%</span>}
                </div>
              </div>

              {/* Member Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Suresh */}
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">👤</div>
                      <div>
                        <p className="text-xs font-bold">Suresh</p>
                        <p className="text-[10px] text-muted-foreground">{householdSpend.sureshCount} txns</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">{householdSpend.sureshPct}%</span>
                  </div>
                  <p className="text-lg font-extrabold text-foreground">{formatMoney(householdSpend.sureshTotal)}</p>
                  <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground border-t border-border/40 pt-1.5">
                    <span>🏠 {formatMoney(householdSpend.sureshJoint)}</span>
                    <span>·</span>
                    <span>👤 {formatMoney(householdSpend.sureshPersonal)}</span>
                  </div>
                </div>

                {/* Rosy */}
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center text-sm">🌸</div>
                      <div>
                        <p className="text-xs font-bold">Rosy</p>
                        <p className="text-[10px] text-muted-foreground">{householdSpend.rosyCount} txns</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">{householdSpend.rosyPct}%</span>
                  </div>
                  <p className="text-lg font-extrabold text-foreground">{formatMoney(householdSpend.rosyTotal)}</p>
                  <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground border-t border-border/40 pt-1.5">
                    <span>🏠 {formatMoney(householdSpend.rosyJoint)}</span>
                    <span>·</span>
                    <span>🌸 {formatMoney(householdSpend.rosyPersonal)}</span>
                  </div>
                </div>

                {/* Settlement */}
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 sm:col-span-1">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Scale className="w-3.5 h-3.5 text-primary" />
                    <p className="text-xs font-bold text-foreground">Split Summary</p>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span className="text-muted-foreground">🏠 Joint:</span><span className="font-bold">{formatMoney(householdSpend.jointTotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">👤 Personal:</span><span className="font-bold">{formatMoney(householdSpend.personalTotal)}</span></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/40 text-[10px]">
                    {householdSpend.totalExp === 0 ? (
                      <span className="text-muted-foreground">No expenses yet</span>
                    ) : householdSpend.sureshTotal > 0 && householdSpend.rosyTotal > 0 ? (
                      householdSpend.diff === 0
                        ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">🎉 Perfect 50/50 split!</span>
                        : <span className="text-muted-foreground">🤝 {householdSpend.jointLower} owes {formatMoney(householdSpend.settlementAmt)} to {householdSpend.jointHigher}</span>
                    ) : (
                      <span className="text-muted-foreground">Only {householdSpend.higherSpender} logged expenses</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── BUDGET HEALTH (only shown if budget set) ── */}
          {monthlyBudget > 0 && (
            <div id="tour-budget-health" className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className={cn(
                'px-5 py-3.5 flex items-center justify-between border-b',
                isOverBudget ? 'bg-red-500/8 border-red-500/20' : budgetHealth > 80 ? 'bg-amber-500/8 border-amber-500/20' : 'bg-emerald-500/8 border-emerald-500/20'
              )}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{isOverBudget ? '⚠️' : budgetHealth > 80 ? '⚡' : '✅'}</span>
                  <div>
                    <p className="font-bold text-sm text-foreground">
                      {isOverBudget ? `Over Budget by ${formatMoney(Math.abs(remaining))}` : budgetHealth > 80 ? 'Almost at Limit' : 'Budget On Track'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{daysLeft}d left · Daily burn: {formatMoney(Math.round(dailyBurnRate))}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold text-foreground">{Math.round(budgetHealth)}%</p>
                  <p className="text-[10px] text-muted-foreground">of budget</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {/* Stacked bar */}
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  <div className="absolute left-0 top-0 h-full rounded-l-full" style={{ width: `${Math.min((expense / monthlyBudget) * 100, 100)}%`, backgroundColor: '#ef4444' }} />
                  <div className="absolute top-0 h-full" style={{ left: `${Math.min((expense / monthlyBudget) * 100, 100)}%`, width: `${Math.min((debt / monthlyBudget) * 100, 100 - Math.min((expense / monthlyBudget) * 100, 100))}%`, backgroundColor: '#f97316' }} />
                  <div className="absolute top-0 h-full" style={{ left: `${Math.min(((expense + debt) / monthlyBudget) * 100, 100)}%`, width: `${Math.min((savings / monthlyBudget) * 100, 100 - Math.min(((expense + debt) / monthlyBudget) * 100, 100))}%`, backgroundColor: '#3b82f6' }} />
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" />Expenses {formatMoney(expense)}</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" />Debt {formatMoney(debt)}</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" />Savings {formatMoney(savings)}</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-muted-foreground/30" />Left {formatMoney(Math.max(remaining, 0))}</span>
                </div>

                {/* 4 stat boxes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Spent',     value: formatMoney(expense),                           icon: '🛍️', sub: `${monthlyBudget > 0 ? Math.round((expense / monthlyBudget) * 100) : 0}% of budget`, color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-900/10',     border: 'border-red-200 dark:border-red-900/30' },
                    { label: 'Saved',     value: formatMoney(savings),                           icon: '🏦', sub: income > 0 ? `${Math.round((savings / income) * 100)}% of income` : '-',             color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/10',   border: 'border-blue-200 dark:border-blue-900/30' },
                    { label: 'Remaining', value: formatMoney(Math.max(remaining, 0)),            icon: isOverBudget ? '🚨' : '💰', sub: isOverBudget ? '⚠️ Over!' : `${daysLeft}d to go`, color: isOverBudget ? 'text-destructive' : 'text-emerald-500', bg: isOverBudget ? 'bg-red-50 dark:bg-red-900/10' : 'bg-green-50 dark:bg-green-900/10', border: isOverBudget ? 'border-red-200 dark:border-red-900/30' : 'border-green-200 dark:border-green-900/30' },
                    { label: 'Projected', value: formatMoney(Math.round(projectedMonthly)),      icon: '📊', sub: projectedMonthly > monthlyBudget ? `⚠️ ${formatMoney(Math.round(projectedMonthly - monthlyBudget))} over` : 'On track', color: projectedMonthly > monthlyBudget ? 'text-destructive' : 'text-emerald-500', bg: projectedMonthly > monthlyBudget ? 'bg-red-50 dark:bg-red-900/10' : 'bg-green-50 dark:bg-green-900/10', border: projectedMonthly > monthlyBudget ? 'border-red-200 dark:border-red-900/30' : 'border-green-200 dark:border-green-900/30' },
                  ].map(s => (
                    <div key={s.label} className={cn('rounded-xl border p-3 space-y-1', s.bg, s.border)}>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-muted-foreground">{s.label}</p>
                        <span className="text-base">{s.icon}</span>
                      </div>
                      <p className={cn('text-sm sm:text-base font-bold tracking-tight', s.color)}>{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SPENDING TAB ── */}
      {activeTab === 'spending' && (
        <div className="space-y-5">
          {/* Category budget bars */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Category Tracker</h3>
              <span className="text-xs text-muted-foreground">Total: <span className="font-bold text-foreground">{formatMoney(expense)}</span>{monthlyBudget > 0 && ` / ${formatMoney(monthlyBudget)}`}</span>
            </div>
            {expenseCategories.length > 0 ? (
              <div className="space-y-4">
                {expenseCategories.map(cat => (
                  <ProgressBar key={cat.id} label={cat.name} value={cat.spent} max={cat.budget || 0} color={cat.color} formatMoney={formatMoney} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No expenses this month yet.</p>
            )}
          </div>

          {/* Payment Mode Breakdown */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" />Payment Mode</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'upi', label: 'UPI', emoji: '📱', color: '#8b5cf6' },
                { id: 'cash', label: 'Cash', emoji: '💵', color: '#10b981' },
                { id: 'card', label: 'Card', emoji: '💳', color: '#3b82f6' },
                { id: 'netbanking', label: 'Net Banking', emoji: '🏦', color: '#f59e0b' },
              ].map(mode => {
                const total = monthlyTx.filter(t => t.type === 'expense' && t.paymentMode === mode.id).reduce((s, t) => s + t.amount, 0);
                const pct = expense > 0 ? Math.round((total / expense) * 100) : 0;
                return (
                  <div key={mode.id} className="bg-muted/30 rounded-xl p-4 text-center border border-border/50">
                    <div className="text-2xl mb-1">{mode.emoji}</div>
                    <p className="text-xs font-semibold text-muted-foreground">{mode.label}</p>
                    <p className="text-base font-bold mt-1">{formatMoney(total)}</p>
                    <p className="text-[10px] text-muted-foreground">{pct}%</p>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: mode.color }} />
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
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Savings Rate', value: Math.max(savingsRate, 0), unit: '%', desc: 'Target: 20%+ of income', color: '#10b981' },
              { label: 'Budget Control', value: Math.max(0, 100 - budgetUsed), unit: '%', desc: `${formatMoney(Math.max((monthlyBudget || 0) - expense, 0))} remaining`, color: '#3b82f6' },
              { label: 'Debt Progress', value: totalEMI > 0 ? Math.min(Math.round((debt / totalEMI) * 100), 100) : 0, unit: '%', desc: loans.length > 0 ? `${loans.length} active loan${loans.length > 1 ? 's' : ''}` : 'No loans', color: '#f59e0b' },
            ].map(goal => (
              <div key={goal.label} className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
                <div className="flex justify-center">
                  <CircleProgress percentage={Math.min(Math.max(goal.value, 0), 100)} size={100} strokeWidth={8} color={goal.color} />
                </div>
                <p className="font-bold mt-3">{goal.label}</p>
                <p className="text-3xl font-extrabold mt-1">{goal.value}{goal.unit}</p>
                <p className="text-xs text-muted-foreground mt-1">{goal.desc}</p>
              </div>
            ))}
          </div>

          {loans.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" />Loans & EMI</h3>
              <div className="space-y-3">
                {loans.map(loan => (
                  <div key={loan.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <div>
                      <p className="font-semibold text-sm">{loan.name}</p>
                      <p className="text-xs text-muted-foreground">{loan.type === 'emi' ? `${loan.tenure} months` : 'Personal debt'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-orange-500">{formatMoney(loan.monthlyAmount || loan.principal)}</p>
                      <p className="text-xs text-muted-foreground">{loan.type === 'emi' ? '/month' : 'principal'}</p>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-border text-sm font-bold">
                  <span>Total EMI</span>
                  <span className="text-orange-500">{formatMoney(totalEMI)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TOUR OVERLAY ── */}
      {showTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {tourSteps[tourStep].target === null && (
            <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={handleSkipTour} />
          )}
          {tourSteps[tourStep].target !== null && (
            <>
              <div className="fixed inset-0 bg-transparent" onClick={handleSkipTour} />
              <div style={spotlightStyle} />
            </>
          )}
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 flex flex-col gap-4">
            <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              <span>Guide Tour</span>
              <span>{tourStep + 1} of {tourSteps.length}</span>
            </div>
            <div className="space-y-2">
              <h4 className="text-base font-bold">{tourSteps[tourStep].title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{tourSteps[tourStep].content}</p>
            </div>
            <div className="flex gap-1.5 justify-center">
              {tourSteps.map((_, idx) => (
                <div key={idx} className={cn('h-1 rounded-full transition-all duration-300', idx === tourStep ? 'w-6 bg-primary' : 'w-1 bg-muted-foreground/30')} />
              ))}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <button onClick={handleSkipTour} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Skip</button>
              <div className="flex gap-2">
                {tourStep > 0 && <button onClick={handlePrevStep} className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:bg-muted">Back</button>}
                <button onClick={handleNextStep} className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90">
                  {tourStep === tourSteps.length - 1 ? 'Get Started' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-background border border-border px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 max-w-[90%]">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm', toast.type === 'success' ? 'bg-green-500/20 text-green-500' : toast.type === 'error' ? 'bg-red-500/20 text-red-500' : 'bg-primary/20 text-primary')}>
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
          </div>
          <p className="text-xs sm:text-sm font-semibold">{toast.message}</p>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
