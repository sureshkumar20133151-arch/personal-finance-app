
// SalaryPocketSystem.jsx
// Virtual Salary Envelope System
// - Salary Pocket setup (allocate virtual envelopes)
// - Live pocket balance cards with progress bars
// - Payment Status picker (Paid / Deferred / Borrowed)
// - Deferred Payments panel
// - Month-End Transfer modal

import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import {
  Wallet, ChevronDown, ChevronUp, Plus, Trash2, Edit2,
  Check, Clock, Users, ArrowRight, AlertCircle,
  Banknote, TrendingUp, PiggyBank, X, CalendarClock,
  HandCoins, Landmark, TriangleAlert
} from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n, formatMoney) => formatMoney ? formatMoney(n) : `₹${n.toLocaleString('en-IN')}`;

const POCKET_COLORS = [
  { id: 'rose',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-500',    bar: '#f43f5e' },
  { id: 'blue',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-500',    bar: '#3b82f6' },
  { id: 'emerald', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-500', bar: '#10b981' },
  { id: 'amber',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-500',   bar: '#f59e0b' },
  { id: 'purple',  bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  text: 'text-purple-500',  bar: '#a855f7' },
  { id: 'cyan',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-500',    bar: '#06b6d4' },
];

const POCKET_ICONS = ['🏠', '👤', '🌸', '🛒', '🎓', '💊', '🚗', '✈️', '🎉', '💰'];

function getPocketColor(colorId) {
  return POCKET_COLORS.find(c => c.id === colorId) || POCKET_COLORS[0];
}

// ─── PaymentStatusBadge ────────────────────────────────────────────────────
export const PaymentStatusBadge = ({ status, deferredTo }) => {
  if (!status || status === 'paid') return null;
  if (status === 'deferred') {
    const daysLeft = deferredTo
      ? Math.ceil((new Date(deferredTo) - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    const urgent = daysLeft !== null && daysLeft <= 3;
    return (
      <span className={cn(
        'inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
        urgent
          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
      )}>
        <Clock className="w-2.5 h-2.5" />
        {deferredTo ? `Due ${format(new Date(deferredTo), 'MMM d')}` : 'Deferred'}
        {daysLeft !== null && ` (${daysLeft}d)`}
      </span>
    );
  }
  if (status === 'borrowed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
        <HandCoins className="w-2.5 h-2.5" />
        Borrowed
      </span>
    );
  }
  return null;
};

// ─── PaymentStatusPicker ───────────────────────────────────────────────────
export const PaymentStatusPicker = ({ value = 'paid', deferredTo, borrowedFrom, onChange, onDeferredToChange, onBorrowedFromChange }) => {
  const options = [
    { id: 'paid',     label: 'Paid Now',    icon: '✅', desc: 'Money left my hand today' },
    { id: 'deferred', label: 'Pay Later',   icon: '⏳', desc: "I'll pay on a future date" },
    { id: 'borrowed', label: 'Borrowed',    icon: '🤝', desc: 'Paid using borrowed money' },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Status</p>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'flex flex-col items-center gap-0.5 p-2 rounded-xl border text-center transition-all text-xs font-semibold',
              value === opt.id
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : 'border-border/50 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-muted'
            )}
          >
            <span className="text-base leading-tight">{opt.icon}</span>
            <span className="text-[10px] leading-tight">{opt.label}</span>
          </button>
        ))}
      </div>

      {value === 'deferred' && (
        <div className="flex gap-2 animate-in fade-in duration-200">
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5 block">Due Date</label>
            <input
              type="date"
              value={deferredTo || ''}
              onChange={e => onDeferredToChange?.(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full h-8 px-2 text-xs bg-muted/60 border border-border/60 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>
      )}

      {value === 'borrowed' && (
        <div className="animate-in fade-in duration-200">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5 block">Borrowed From</label>
          <input
            type="text"
            value={borrowedFrom || ''}
            onChange={e => onBorrowedFromChange?.(e.target.value)}
            placeholder="e.g. Rajan, Anna, Friend..."
            className="w-full h-8 px-2 text-xs bg-muted/60 border border-border/60 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60"
          />
          <p className="text-[10px] text-amber-500 mt-1">A debt entry will be auto-created for this loan.</p>
        </div>
      )}
    </div>
  );
};

// ─── PocketSetupModal ──────────────────────────────────────────────────────
const PocketSetupModal = ({ onClose, onSave, salaryPockets, monthlySalary, formatMoney }) => {
  const [salary, setSalary] = useState(monthlySalary || 50000);
  const [pockets, setPockets] = useState(
    salaryPockets && salaryPockets.length > 0
      ? salaryPockets.map(p => ({ ...p }))
      : [
          { id: 'p1', name: "Wife's Home Expenses", icon: '🏠', color: 'rose',    allocatedTo: 'Rosy',   allocatedAmount: 20000 },
          { id: 'p2', name: "Husband's Pocket Money", icon: '👤', color: 'blue', allocatedTo: 'Suresh', allocatedAmount: 5000  },
        ]
  );
  const [showIconPicker, setShowIconPicker] = useState(null);

  const totalAllocated = pockets.reduce((s, p) => s + (Number(p.allocatedAmount) || 0), 0);
  const buffer = salary - totalAllocated;
  const isOver = buffer < 0;

  const addPocket = () => {
    setPockets(prev => [...prev, {
      id: `p_${Date.now()}`,
      name: 'New Pocket',
      icon: '💰',
      color: POCKET_COLORS[prev.length % POCKET_COLORS.length].id,
      allocatedTo: 'Both',
      allocatedAmount: 0,
    }]);
  };

  const updatePocket = (id, field, val) => {
    setPockets(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const removePocket = (id) => {
    setPockets(prev => prev.filter(p => p.id !== id));
  };

  const handleSave = () => {
    onSave({
      monthlySalary: Number(salary) || 0,
      salaryPockets: pockets.map(p => ({
        ...p,
        allocatedAmount: Number(p.allocatedAmount) || 0,
      })),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-sm">Salary Pocket Allocator</h2>
              <p className="text-[10px] text-muted-foreground">Set virtual envelopes for your salary</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
          {/* Monthly Salary Input */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Monthly Salary</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
              <input
                type="number"
                value={salary}
                onChange={e => setSalary(e.target.value)}
                className="w-full h-11 pl-7 pr-3 text-sm font-semibold bg-muted/60 border border-border/60 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="50000"
              />
            </div>
          </div>

          {/* Allocation Summary Bar */}
          <div className="rounded-xl bg-muted/50 border border-border/50 p-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-foreground">Total Salary: {fmt(salary, formatMoney)}</span>
              <span className={cn('font-bold', isOver ? 'text-red-500' : 'text-emerald-500')}>
                {isOver ? `Over by ${fmt(Math.abs(buffer), formatMoney)}` : `Buffer: ${fmt(buffer, formatMoney)}`}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden flex gap-0.5">
              {pockets.map(p => {
                const pct = salary > 0 ? Math.max(0, (Number(p.allocatedAmount) / salary) * 100) : 0;
                const col = getPocketColor(p.color);
                return (
                  <div key={p.id} className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: col.bar }} />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {pockets.map(p => {
                const col = getPocketColor(p.color);
                return (
                  <span key={p.id} className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', col.bg, col.text)}>
                    {p.icon} {fmt(p.allocatedAmount, formatMoney)}
                  </span>
                );
              })}
              {buffer >= 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  💛 Buffer: {fmt(buffer, formatMoney)}
                </span>
              )}
            </div>
          </div>

          {/* Pocket List */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Virtual Pockets</p>
            {pockets.map(pocket => {
              const col = getPocketColor(pocket.color);
              return (
                <div key={pocket.id} className={cn('rounded-xl border p-3 space-y-2', col.border, col.bg)}>
                  <div className="flex items-center gap-2">
                    {/* Icon picker */}
                    <button
                      type="button"
                      onClick={() => setShowIconPicker(showIconPicker === pocket.id ? null : pocket.id)}
                      className="text-xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-black/10 transition-colors"
                    >
                      {pocket.icon}
                    </button>

                    <input
                      type="text"
                      value={pocket.name}
                      onChange={e => updatePocket(pocket.id, 'name', e.target.value)}
                      className="flex-1 h-8 px-2 text-xs font-semibold bg-background/60 border border-border/50 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="Pocket name..."
                    />

                    <button
                      type="button"
                      onClick={() => removePocket(pocket.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {showIconPicker === pocket.id && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-background/70 rounded-lg">
                      {POCKET_ICONS.map(ic => (
                        <button key={ic} type="button" onClick={() => { updatePocket(pocket.id, 'icon', ic); setShowIconPicker(null); }}
                          className="w-8 h-8 text-lg flex items-center justify-center rounded-lg hover:bg-muted transition-colors">{ic}</button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5 block">Allocated To</label>
                      <select
                        value={pocket.allocatedTo}
                        onChange={e => updatePocket(pocket.id, 'allocatedTo', e.target.value)}
                        className="w-full h-8 px-2 text-xs font-semibold bg-background/60 border border-border/50 rounded-lg text-foreground focus:outline-none"
                      >
                        <option value="Rosy">🌸 Rosy (Wife)</option>
                        <option value="Suresh">👤 Suresh (Husband)</option>
                        <option value="Both">🤝 Both</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5 block">Amount (₹)</label>
                      <input
                        type="number"
                        value={pocket.allocatedAmount}
                        onChange={e => updatePocket(pocket.id, 'allocatedAmount', e.target.value)}
                        className="w-full h-8 px-2 text-xs font-semibold bg-background/60 border border-border/50 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Color picker */}
                  <div className="flex gap-1.5">
                    {POCKET_COLORS.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => updatePocket(pocket.id, 'color', c.id)}
                        className={cn('w-5 h-5 rounded-full transition-all border-2', pocket.color === c.id ? 'border-white scale-110' : 'border-transparent')}
                        style={{ backgroundColor: c.bar }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addPocket}
              className="w-full h-9 border-2 border-dashed border-border/50 rounded-xl text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Pocket
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isOver}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Pockets
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MonthEndModal ─────────────────────────────────────────────────────────
const MonthEndModal = ({ onClose, buffer, onTransferToSavings, formatMoney }) => {
  const [amount, setAmount] = useState(buffer);
  const [done, setDone] = useState(false);

  const handleTransfer = () => {
    if (Number(amount) > 0) {
      onTransferToSavings(Number(amount));
      setDone(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 text-center">
          {done ? (
            <>
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="font-bold text-lg text-foreground">Saved to Savings!</h2>
              <p className="text-sm text-muted-foreground mt-1">{fmt(amount, formatMoney)} moved to your liquid savings pool.</p>
              <button onClick={onClose} className="mt-4 w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-bold">Done</button>
            </>
          ) : (
            <>
              <div className="text-4xl mb-3">📅</div>
              <h2 className="font-bold text-lg text-foreground">Month-End Transfer</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Move your remaining salary buffer to savings?</p>

              <div className="bg-muted/60 rounded-xl p-3 mb-4 text-left space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Available Buffer</span>
                  <span className="font-bold text-emerald-500">{fmt(buffer, formatMoney)}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block text-left">Amount to Transfer</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    max={buffer}
                    className="w-full h-10 pl-7 pr-3 text-sm font-semibold bg-muted/60 border border-border/60 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted">
                  Keep as Buffer
                </button>
                <button onClick={handleTransfer} disabled={!amount || Number(amount) <= 0}
                  className="flex-1 h-10 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50">
                  Transfer →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── DeferredPaymentsPanel ─────────────────────────────────────────────────
export const DeferredPaymentsPanel = ({
  transactions,
  onMarkPaid,
  onAddPending,
  categories = [],
  defaultActor = 'Suresh',
  formatMoney
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for new pending payment
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [deferredTo, setDeferredTo] = useState('');
  const [deferredNote, setDeferredNote] = useState('');
  const [paidBy, setPaidBy] = useState(defaultActor || 'Suresh');
  const [categoryId, setCategoryId] = useState('');

  const deferred = useMemo(() =>
    (transactions || [])
      .filter(t => t.paymentStatus === 'deferred')
      .sort((a, b) => {
        if (a.deferredTo && b.deferredTo) return new Date(a.deferredTo) - new Date(b.deferredTo);
        return 0;
      }),
    [transactions]
  );

  const totalPendingAmount = useMemo(() =>
    deferred.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [deferred]
  );

  const overdue = deferred.filter(t => t.deferredTo && new Date(t.deferredTo) < new Date()).length;

  const handleSavePending = (e) => {
    e?.preventDefault();
    if (!desc.trim()) return;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    if (onAddPending) {
      onAddPending({
        description: desc.trim(),
        amount: numAmount,
        deferredTo: deferredTo || null,
        deferredNote: deferredNote.trim() || null,
        paidBy: paidBy || defaultActor || 'Suresh',
        categoryId: categoryId || (categories.find(c => c.type === 'expense')?.id || 'other'),
      });
    }

    // Reset form
    setDesc('');
    setAmount('');
    setDeferredTo('');
    setDeferredNote('');
    setShowAddModal(false);
  };

  const PRESETS = [
    { label: '🏠 House Rent', desc: 'House Rent', note: 'Promised to pay next week' },
    { label: '🪙 Chit Fund', desc: 'Chit Fund Payment', note: 'Due this month' },
    { label: '🤝 Hand Loan', desc: 'Borrowed from friend', note: 'Promise to return' },
    { label: '🥛 Milk & Grocery', desc: 'Grocery / Milk Pending', note: 'Shop credit bill' },
    { label: '⚡ Utility Bill', desc: 'Electricity / Water Bill', note: 'Pay before last date' },
  ];

  return (
    <>
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm text-foreground">⏳ Pending Payments</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  {deferred.length} pending
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Total to pay: <strong className="text-foreground">{fmt(totalPendingAmount, formatMoney)}</strong>
                {overdue > 0 && <span className="ml-1 text-red-500 font-bold">• {overdue} overdue!</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm shadow-amber-500/30"
              title="Add a pending payment"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Pending</span>
            </button>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-1.5 rounded-lg hover:bg-amber-500/20 text-muted-foreground transition-colors"
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Content */}
        {!collapsed && (
          <div className="p-3 sm:p-4 space-y-2">
            {deferred.length > 0 ? (
              deferred.map(tx => {
                const daysLeft = tx.deferredTo
                  ? Math.ceil((new Date(tx.deferredTo) - new Date()) / (1000 * 60 * 60 * 24))
                  : null;
                const isOverdue = daysLeft !== null && daysLeft < 0;
                const urgent = daysLeft !== null && daysLeft <= 3 && !isOverdue;

                return (
                  <div key={tx.id} className={cn(
                    'flex items-center justify-between gap-3 rounded-xl p-3 border transition-all',
                    isOverdue
                      ? 'bg-red-500/10 border-red-500/30'
                      : urgent
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-card border-border/60 hover:border-border'
                  )}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-foreground truncate">{tx.description}</p>
                        {tx.paidBy && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                            {tx.paidBy === 'Rosy' ? '🌸 Rosy' : '👤 Suresh'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px]">
                        <span className={cn('font-bold', isOverdue ? 'text-red-500' : urgent ? 'text-amber-500' : 'text-muted-foreground')}>
                          {tx.deferredTo
                            ? isOverdue
                              ? `⚠️ Overdue since ${format(new Date(tx.deferredTo), 'MMM d')}`
                              : `Due ${format(new Date(tx.deferredTo), 'MMM d')} (${daysLeft}d left)`
                            : 'No due date'}
                        </span>
                        {tx.deferredNote && (
                          <span className="text-muted-foreground italic truncate max-w-[150px]">
                            • "{tx.deferredNote}"
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs sm:text-sm font-extrabold text-foreground">{fmt(tx.amount, formatMoney)}</span>
                      <button
                        onClick={() => onMarkPaid(tx.id)}
                        className="h-7 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold transition-all flex items-center gap-1 shadow-sm shadow-emerald-500/20 active:scale-95"
                        title="Mark as paid"
                      >
                        <Check className="w-3 h-3" />
                        <span>Pay</span>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/40 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span>🎉</span> No pending payments. You don't owe anyone right now!
                </span>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-[11px] text-amber-500 hover:underline font-bold"
                >
                  + Add Pending
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: ADD PENDING PAYMENT ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                  ⏳
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Add Pending Payment</h3>
                  <p className="text-[10px] text-muted-foreground">Record money you promised to pay later</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Presets */}
            <div className="p-3 bg-muted/30 border-b border-border/40 space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Quick Select</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setDesc(p.desc);
                      setDeferredNote(p.note);
                    }}
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all',
                      desc === p.desc
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-background text-muted-foreground border-border hover:border-amber-500/50'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePending} className="p-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Whom to Pay / Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. House Rent, Chit Fund, Friend Ramesh"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 mt-1 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 mt-1 shadow-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Promised Due Date</label>
                  <input
                    type="date"
                    value={deferredTo}
                    onChange={e => setDeferredTo(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 mt-1 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Who Will Pay</label>
                  <select
                    value={paidBy}
                    onChange={e => setPaidBy(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 mt-1 shadow-sm"
                  >
                    <option value="Suresh">👤 Suresh</option>
                    <option value="Rosy">🌸 Rosy</option>
                    <option value="Both">🤝 Both (Joint)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Category</label>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 mt-1 shadow-sm"
                  >
                    <option value="">Select Category</option>
                    {categories.filter(c => c.type === 'expense').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Note / Promise to Pay</label>
                <input
                  type="text"
                  placeholder="e.g. Promised to pay next month 5th"
                  value={deferredNote}
                  onChange={e => setDeferredNote(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 mt-1 shadow-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-xs px-3 py-1.5 rounded-lg border text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!desc.trim() || !amount}
                  className="text-xs px-4 py-1.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-sm transition-all disabled:opacity-50"
                >
                  Save Pending Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};


// ─── SalaryPocketDashboard (Main Card) ────────────────────────────────────
const SalaryPocketDashboard = ({
  monthlySalary = 0,
  salaryPockets = [],
  transactions = [],
  currentMonth,
  onSetup,
  onMonthEnd,
  formatMoney,
}) => {
  const [expanded, setExpanded] = useState(true);

  // Calculate spent per pocket from PAID transactions this month
  const pocketStats = useMemo(() => {
    const monthStart = startOfMonth(currentMonth || new Date());
    const monthEnd = endOfMonth(currentMonth || new Date());

    const monthlyTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd && t.type === 'expense';
    });

    return salaryPockets.map(pocket => {
      // Match transactions by paidBy pocket owner + scope
      const paidSpent = monthlyTx
        .filter(t => t.paymentStatus !== 'deferred' && t.paidBy === pocket.allocatedTo)
        .reduce((s, t) => s + (t.amount || 0), 0);
      const deferredAmt = monthlyTx
        .filter(t => t.paymentStatus === 'deferred' && t.paidBy === pocket.allocatedTo)
        .reduce((s, t) => s + (t.amount || 0), 0);

      const remaining = Math.max(0, pocket.allocatedAmount - paidSpent);
      const pct = pocket.allocatedAmount > 0 ? Math.min(100, (paidSpent / pocket.allocatedAmount) * 100) : 0;
      const col = getPocketColor(pocket.color);
      return { ...pocket, paidSpent, deferredAmt, remaining, pct, col };
    });
  }, [salaryPockets, transactions, currentMonth]);

  const totalAllocated = salaryPockets.reduce((s, p) => s + (p.allocatedAmount || 0), 0);
  const buffer = monthlySalary - totalAllocated;
  const totalPaidThisMonth = pocketStats.reduce((s, p) => s + p.paidSpent, 0);
  const totalDeferred = pocketStats.reduce((s, p) => s + p.deferredAmt, 0);
  const isThisMonth = isSameMonth(currentMonth || new Date(), new Date());

  if (!monthlySalary) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">💰</div>
        <div>
          <p className="font-bold text-foreground">Set Up Salary Pockets</p>
          <p className="text-xs text-muted-foreground mt-0.5">Allocate your salary into virtual envelopes — Home expenses, personal pocket money, and a savings buffer.</p>
        </div>
        <button
          onClick={onSetup}
          className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          + Set Up Pockets
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">Salary Pockets</p>
            <p className="text-[10px] text-muted-foreground">
              {fmt(monthlySalary, formatMoney)} · {fmt(totalAllocated, formatMoney)} allocated · {fmt(buffer, formatMoney)} buffer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isThisMonth && buffer > 0 && (
            <button
              onClick={onMonthEnd}
              className="h-7 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] font-bold hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
            >
              <PiggyBank className="w-3 h-3" />
              Save Buffer
            </button>
          )}
          <button
            onClick={onSetup}
            className="h-7 px-2.5 rounded-lg bg-muted text-muted-foreground text-[10px] font-bold hover:bg-muted/80 transition-colors flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </button>
          <button onClick={() => setExpanded(e => !e)} className="p-1 rounded-lg hover:bg-muted transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* Monthly summary bar */}
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border/30">
        <div className="flex justify-between text-[10px] mb-1 font-semibold">
          <span className="text-muted-foreground">Spent: <span className="text-foreground">{fmt(totalPaidThisMonth, formatMoney)}</span></span>
          {totalDeferred > 0 && <span className="text-amber-500">Deferred: {fmt(totalDeferred, formatMoney)}</span>}
          <span className="text-emerald-500">Remaining salary: {fmt(Math.max(0, monthlySalary - totalPaidThisMonth), formatMoney)}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${monthlySalary > 0 ? Math.min(100, (totalPaidThisMonth / monthlySalary) * 100) : 0}%` }}
          />
        </div>
      </div>

      {/* Pocket Cards */}
      {expanded && (
        <div className="p-4 grid gap-3 sm:grid-cols-2">
          {pocketStats.map(pocket => {
            const barColor = pocket.pct >= 90 ? '#ef4444' : pocket.pct >= 60 ? '#f59e0b' : pocket.col.bar;
            return (
              <div key={pocket.id} className={cn('rounded-xl border p-3 space-y-2', pocket.col.border, pocket.col.bg)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{pocket.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-foreground leading-tight">{pocket.name}</p>
                      <p className="text-[10px] text-muted-foreground">{pocket.allocatedTo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-extrabold', pocket.col.text)}>{fmt(pocket.remaining, formatMoney)}</p>
                    <p className="text-[10px] text-muted-foreground">of {fmt(pocket.allocatedAmount, formatMoney)}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pocket.pct}%`, backgroundColor: barColor }}
                  />
                </div>

                <div className="flex justify-between text-[10px] font-semibold">
                  <span className="text-muted-foreground">Spent: {fmt(pocket.paidSpent, formatMoney)}</span>
                  {pocket.deferredAmt > 0 && (
                    <span className="text-amber-500">⏳ {fmt(pocket.deferredAmt, formatMoney)}</span>
                  )}
                  <span className={cn(
                    pocket.pct >= 90 ? 'text-red-500' : pocket.pct >= 60 ? 'text-amber-500' : 'text-emerald-500'
                  )}>
                    {Math.round(pocket.pct)}% used
                  </span>
                </div>
              </div>
            );
          })}

          {/* Buffer Card */}
          {buffer > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">💛</span>
                  <div>
                    <p className="text-xs font-bold text-foreground">Unallocated Buffer</p>
                    <p className="text-[10px] text-muted-foreground">Rolls to savings at month-end</p>
                  </div>
                </div>
                <p className="text-sm font-extrabold text-amber-500">{fmt(buffer, formatMoney)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Export ─────────────────────────────────────────────────────────────
const SalaryPocketSystem = ({
  monthlySalary,
  salaryPockets,
  transactions,
  currentMonth,
  formatMoney,
  onUpdateSalaryPockets,
  onTransferToSavings,
}) => {
  const [showSetup, setShowSetup] = useState(false);
  const [showMonthEnd, setShowMonthEnd] = useState(false);

  const totalAllocated = (salaryPockets || []).reduce((s, p) => s + (p.allocatedAmount || 0), 0);
  const buffer = (monthlySalary || 0) - totalAllocated;

  const handleSave = (data) => {
    onUpdateSalaryPockets(data);
  };

  return (
    <>
      <SalaryPocketDashboard
        monthlySalary={monthlySalary}
        salaryPockets={salaryPockets}
        transactions={transactions}
        currentMonth={currentMonth}
        onSetup={() => setShowSetup(true)}
        onMonthEnd={() => setShowMonthEnd(true)}
        formatMoney={formatMoney}
      />

      {showSetup && (
        <PocketSetupModal
          onClose={() => setShowSetup(false)}
          onSave={handleSave}
          salaryPockets={salaryPockets}
          monthlySalary={monthlySalary}
          formatMoney={formatMoney}
        />
      )}

      {showMonthEnd && (
        <MonthEndModal
          onClose={() => setShowMonthEnd(false)}
          buffer={buffer}
          onTransferToSavings={(amt) => {
            onTransferToSavings(amt);
            setShowMonthEnd(false);
          }}
          formatMoney={formatMoney}
        />
      )}
    </>
  );
};

export default SalaryPocketSystem;
