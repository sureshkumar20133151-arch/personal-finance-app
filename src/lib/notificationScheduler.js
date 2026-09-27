// ─────────────────────────────────────────────────────────────────────────────
//  notificationScheduler.js
//  Smart Reminders & Alert Engine for BudgetTracker
//  Supports Capacitor LocalNotifications (Android/iOS) + Web HTML5 Notifications
// ─────────────────────────────────────────────────────────────────────────────

import { LocalNotifications } from "@capacitor/local-notifications";
import { format, differenceInCalendarDays, parseISO, isAfter, isBefore, addDays } from "date-fns";

/**
 * Initialize Android Notification Channels
 */
export async function initNotificationChannels() {
  if (typeof window === "undefined" || !window.Capacitor?.isNativePlatform()) return;
  try {
    await LocalNotifications.requestPermissions();
    await LocalNotifications.createChannel({
      id: "bills-reminders",
      name: "Bill & EMI Due Reminders",
      description: "Alerts for upcoming loans, EMIs, and pending payments",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
    await LocalNotifications.createChannel({
      id: "budget-alerts",
      name: "Budget & Balance Alerts",
      description: "Alerts when monthly budget is near limit or balance is low",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
  } catch (err) {
    console.warn("[notificationScheduler] Channel init error:", err);
  }
}

/**
 * Generate all active alerts from current finance state
 */
export function generateActiveAlerts({
  transactions = [],
  loans = [],
  recurring = [],
  monthlyBudget = 0,
  currentMonthExpense = 0,
  totalBalance = 0,
}) {
  const alerts = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. EMI & Loan Due Reminders
  loans.forEach((loan) => {
    if (!loan.startDate) return;
    try {
      const start = parseISO(loan.startDate);
      const dueDay = start.getDate();
      
      // Target this month's due date
      const thisMonthDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
      let targetDue = thisMonthDue;
      if (isBefore(thisMonthDue, today)) {
        // Already passed this month, check next month
        targetDue = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
      }

      const daysRemaining = differenceInCalendarDays(targetDue, today);

      if (daysRemaining >= 0 && daysRemaining <= 3) {
        const amount = loan.monthlyAmount || loan.principal || 0;
        const urgency = daysRemaining === 0 ? "critical" : daysRemaining === 1 ? "high" : "medium";
        const dayLabel = daysRemaining === 0 ? "Today!" : daysRemaining === 1 ? "Tomorrow" : `In ${daysRemaining} days`;

        alerts.push({
          id: `loan-${loan.id}-${format(targetDue, "yyyy-MM")}`,
          category: "loan",
          title: `EMI Due: ${loan.name}`,
          message: `₹${Number(amount).toLocaleString("en-IN")} is due ${dayLabel} (${format(targetDue, "dd MMM")}).`,
          dueDate: targetDue.toISOString(),
          daysRemaining,
          urgency,
          actionUrl: "/loans",
        });
      }
    } catch {
      // Ignored: Invalid date format in loan
    }
  });

  // 2. Pending Payments (Deferred transactions: கொடுக்க வேண்டியவை)
  transactions
    .filter((tx) => tx.paymentStatus === "deferred" && tx.deferredTo)
    .forEach((tx) => {
      try {
        const promiseDate = parseISO(tx.deferredTo);
        const daysRemaining = differenceInCalendarDays(promiseDate, today);

        if (daysRemaining <= 3) {
          const urgency = daysRemaining < 0 ? "critical" : daysRemaining === 0 ? "high" : "medium";
          const dayLabel = daysRemaining < 0 
            ? `Overdue by ${Math.abs(daysRemaining)}d` 
            : daysRemaining === 0 
              ? "Due Today" 
              : `Due in ${daysRemaining}d`;

          alerts.push({
            id: `deferred-${tx.id}`,
            category: "deferred",
            title: `Pending Payment: ${tx.description || "Obligation"}`,
            message: `₹${Number(tx.amount).toLocaleString("en-IN")} promised ${dayLabel} (${format(promiseDate, "dd MMM")}).`,
            dueDate: promiseDate.toISOString(),
            daysRemaining,
            urgency,
            actionUrl: "/transactions",
          });
        }
      } catch {
        // Ignored: Invalid date format
      }
    });

  // 3. Recurring Bills & Subscriptions
  recurring
    .filter((r) => r.active)
    .forEach((r) => {
      try {
        const day = Number(r.dayOfMonth || 1);
        const billDue = new Date(today.getFullYear(), today.getMonth(), day);
        let targetDue = billDue;
        if (isBefore(billDue, today)) {
          targetDue = new Date(today.getFullYear(), today.getMonth() + 1, day);
        }

        const daysRemaining = differenceInCalendarDays(targetDue, today);

        if (daysRemaining >= 0 && daysRemaining <= 3) {
          const dayLabel = daysRemaining === 0 ? "Today" : daysRemaining === 1 ? "Tomorrow" : `In ${daysRemaining}d`;
          alerts.push({
            id: `recurring-${r.id}-${format(targetDue, "yyyy-MM")}`,
            category: "recurring",
            title: `Upcoming Bill: ${r.description}`,
            message: `₹${Number(r.amount).toLocaleString("en-IN")} due ${dayLabel} (${format(targetDue, "dd MMM")}).`,
            dueDate: targetDue.toISOString(),
            daysRemaining,
            urgency: daysRemaining <= 1 ? "high" : "medium",
            actionUrl: "/dashboard",
          });
        }
      } catch {
        // Ignored
      }
    });

  // 4. Budget Limit Warnings (80% and 100%)
  if (monthlyBudget > 0) {
    const budgetPct = Math.round((currentMonthExpense / monthlyBudget) * 100);
    if (budgetPct >= 100) {
      alerts.push({
        id: `budget-exceeded-${format(today, "yyyy-MM")}`,
        category: "budget",
        title: "🚨 Monthly Budget Exceeded",
        message: `You spent ₹${Number(currentMonthExpense).toLocaleString("en-IN")} (${budgetPct}% of ₹${Number(monthlyBudget).toLocaleString("en-IN")} limit).`,
        urgency: "critical",
        actionUrl: "/budget",
      });
    } else if (budgetPct >= 80) {
      alerts.push({
        id: `budget-warning-80-${format(today, "yyyy-MM")}`,
        category: "budget",
        title: "⚠️ 80% Monthly Budget Reached",
        message: `You spent ₹${Number(currentMonthExpense).toLocaleString("en-IN")} of your ₹${Number(monthlyBudget).toLocaleString("en-IN")} limit (${budgetPct}% used).`,
        urgency: "medium",
        actionUrl: "/budget",
      });
    }
  }

  // 5. Low Balance Alert
  if (totalBalance > 0 && totalBalance < 1000) {
    alerts.push({
      id: "low-balance-alert",
      category: "balance",
      title: "📉 Low Total Balance Warning",
      message: `Total combined balance is ₹${Number(totalBalance).toLocaleString("en-IN")}. Maintain a safe buffer.`,
      urgency: "high",
      actionUrl: "/setup",
    });
  }

  return alerts;
}

/**
 * Sync active alerts to Capacitor LocalNotifications
 */
export async function syncNativeNotifications(alerts = []) {
  if (typeof window === "undefined") return;

  // 1. Mobile Native (Capacitor)
  if (window.Capacitor?.isNativePlatform()) {
    try {
      const scheduled = await LocalNotifications.getPending();
      if (scheduled?.notifications?.length > 0) {
        await LocalNotifications.cancel({ notifications: scheduled.notifications });
      }

      if (alerts.length > 0) {
        const notifications = alerts.slice(0, 10).map((alert, index) => ({
          id: 1000 + index,
          title: alert.title,
          body: alert.message,
          channelId: alert.category === "budget" || alert.category === "balance" ? "budget-alerts" : "bills-reminders",
          schedule: { at: new Date(Date.now() + 3000 + index * 1000) },
        }));

        await LocalNotifications.schedule({ notifications });
      }
    } catch (err) {
      console.warn("[notificationScheduler] Native notification sync error:", err);
    }
  }

  // 2. Web Browser Notification (Desktop / Mobile Web fallback)
  if (typeof Notification !== "undefined" && Notification.permission === "granted" && alerts.length > 0) {
    try {
      const critical = alerts.find((a) => a.urgency === "critical");
      if (critical) {
        const lastSent = sessionStorage.getItem("last_web_notification_sent");
        if (lastSent !== critical.id) {
          new Notification(critical.title, {
            body: critical.message,
            icon: "/app-icon-512.png",
          });
          sessionStorage.setItem("last_web_notification_sent", critical.id);
        }
      }
    } catch {
      // Ignored in private browsing / iframe
    }
  }
}
