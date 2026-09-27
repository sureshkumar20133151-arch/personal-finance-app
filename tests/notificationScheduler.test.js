import { describe, it, expect } from 'vitest';
import { generateActiveAlerts } from '../src/lib/notificationScheduler.js';
import { format, addDays, subDays } from 'date-fns';

describe('Notification & Reminder Scheduler', () => {
  const today = new Date();

  it('generates EMI due alert for loans due in next 3 days', () => {
    const dueDate = addDays(today, 2);
    const loans = [
      {
        id: 'loan-1',
        name: 'HDFC Car Loan',
        type: 'emi',
        startDate: format(dueDate, 'yyyy-MM-dd'),
        monthlyAmount: 8500,
        tenure: 36,
      },
    ];

    const alerts = generateActiveAlerts({ loans });
    const loanAlert = alerts.find(a => a.category === 'loan');
    expect(loanAlert).toBeDefined();
    expect(loanAlert.title).toContain('HDFC Car Loan');
    expect(loanAlert.message).toContain('8,500');
  });

  it('generates pending payment reminder for deferred transactions', () => {
    const promiseDate = addDays(today, 1);
    const transactions = [
      {
        id: 'tx-1',
        description: 'Repay Ravi',
        amount: 2500,
        paymentStatus: 'deferred',
        deferredTo: format(promiseDate, 'yyyy-MM-dd'),
      },
    ];

    const alerts = generateActiveAlerts({ transactions });
    const deferredAlert = alerts.find(a => a.category === 'deferred');
    expect(deferredAlert).toBeDefined();
    expect(deferredAlert.title).toContain('Pending Payment');
    expect(deferredAlert.message).toContain('2,500');
  });

  it('generates critical budget exceeded alert when expense >= monthlyBudget', () => {
    const alerts = generateActiveAlerts({
      monthlyBudget: 50000,
      currentMonthExpense: 52000,
    });

    const budgetAlert = alerts.find(a => a.id.startsWith('budget-exceeded'));
    expect(budgetAlert).toBeDefined();
    expect(budgetAlert.urgency).toBe('critical');
    expect(budgetAlert.message).toContain('52,000');
  });

  it('generates 80% budget warning when expense is between 80% and 100%', () => {
    const alerts = generateActiveAlerts({
      monthlyBudget: 50000,
      currentMonthExpense: 42000,
    });

    const budgetAlert = alerts.find(a => a.id.startsWith('budget-warning-80'));
    expect(budgetAlert).toBeDefined();
    expect(budgetAlert.urgency).toBe('medium');
    expect(budgetAlert.message).toContain('42,000');
  });

  it('generates low balance alert when total balance is under ₹1,000', () => {
    const alerts = generateActiveAlerts({
      totalBalance: 650,
    });

    const balanceAlert = alerts.find(a => a.category === 'balance');
    expect(balanceAlert).toBeDefined();
    expect(balanceAlert.title).toContain('Low Total Balance');
    expect(balanceAlert.message).toContain('650');
  });
});
