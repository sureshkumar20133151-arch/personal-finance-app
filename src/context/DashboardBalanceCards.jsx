// ─────────────────────────────────────────────────────────────────────────────
//  DashboardBalanceCards.jsx
//
//  Paste this component into your Dashboard.jsx and add it at the top of the
//  dashboard, before the KPI cards.
//
//  Usage inside Dashboard.jsx:
//
//    import DashboardBalanceCards from "./DashboardBalanceCards";
//    // inside your dashboard JSX:
//    <DashboardBalanceCards />
//
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { useFinance } from "./FinanceContext";
import { Pencil } from "lucide-react";

// Bank name → emoji
const BANK_EMOJI = {
  "SBI":           "🔷",
  "HDFC Bank":     "🔴",
  "ICICI Bank":    "🟠",
  "Indian Bank":   "🔵",
  "Canara Bank":   "🟢",
  "Axis Bank":     "🟣",
  "Kotak Bank":    "🟡",
  "Bank of Baroda":"🟤",
  "PNB":           "🟦",
  "Paytm Bank":    "💙",
  "Airtel Bank":   "🔴",
  "GPay":          "🎯",
  "PhonePe":       "💜",
};

// Bank name → gradient colors
const BANK_GRADIENT = {
  "SBI":           ["#0284c7", "#0369a1"],
  "HDFC Bank":     ["#dc2626", "#b91c1c"],
  "ICICI Bank":    ["#ea580c", "#c2410c"],
  "Indian Bank":   ["#1d4ed8", "#1e40af"],
  "Canara Bank":   ["#0d9488", "#0f766e"],
  "Axis Bank":     ["#7c3aed", "#6d28d9"],
  "Kotak Bank":    ["#ca8a04", "#a16207"],
  "Bank of Baroda":["#92400e", "#78350f"],
  "PNB":           ["#1d4ed8", "#1e40af"],
  "GPay":          ["#4285f4", "#1a73e8"],
  "PhonePe":       ["#5f259f", "#4a1d96"],
};

function BalanceCard({ bankName, accountEnding, balance, transactionCount, formatMoney, adjustBankBalance }) {
  const handleEdit = () => {
    const input = prompt(`Enter actual balance for ${bankName}:`, balance);
    if (input !== null && input.trim() !== "") {
      const num = parseFloat(input);
      if (!isNaN(num)) {
        adjustBankBalance(bankName, accountEnding, num);
      }
    }
  };
  const emoji    = BANK_EMOJI[bankName]    || "🏦";
  const gradient = BANK_GRADIENT[bankName] || ["#6366f1", "#4f46e5"];

  return (
    <div
      className="flex-shrink-0 w-52 rounded-2xl border p-4 shadow-sm snap-start transition-all relative overflow-hidden hover:shadow-md"
      style={{ background: `linear-gradient(135deg, ${gradient[0]}18, ${gradient[1]}08)` }}
    >
      {/* Decorative blob */}
      <div
        className="absolute -right-8 -top-8 w-24 h-24 rounded-full opacity-10 blur-xl"
        style={{ backgroundColor: gradient[0] }}
      />

      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            {bankName}
          </p>
          <p className="text-xs text-muted-foreground/80 mt-0.5 font-medium">
            A/c •••• {accountEnding}
          </p>
        </div>
        <span className="text-lg">{emoji}</span>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <p
            className="text-2xl font-bold tracking-tight leading-none"
            style={{ color: balance >= 0 ? gradient[0] : "#ef4444" }}
          >
            {formatMoney(balance)}
          </p>
          <button 
            onClick={handleEdit} 
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Adjust Balance"
          >
            <Pencil size={14} className="text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5 font-medium">
          {transactionCount} transactions
        </p>
      </div>
    </div>
  );
}

export default function DashboardBalanceCards() {
  const {
    bankBalance,
    cashBalance,
    totalBalance,
    bankAccountBalances,
    formatMoney,
    adjustBankBalance,
  } = useFinance();

  return (
    <div className="space-y-3">
      {/* ── Summary row ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border bg-card p-4 shadow-sm text-center">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
            Bank Balance
          </p>
          <p className={`text-lg font-bold ${bankBalance >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-500"}`}>
            {formatMoney(bankBalance)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm text-center">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
            Cash in Hand
          </p>
          <p className={`text-lg font-bold ${cashBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
            {formatMoney(cashBalance)}
          </p>
        </div>
        <div className="rounded-2xl border bg-primary/10 border-primary/20 p-4 shadow-sm text-center">
          <p className="text-[10px] uppercase font-bold text-primary/70 tracking-wider mb-1">
            Total
          </p>
          <p className={`text-lg font-bold ${totalBalance >= 0 ? "text-primary" : "text-red-500"}`}>
            {formatMoney(totalBalance)}
          </p>
        </div>
      </div>

      {/* ── Per-bank cards (horizontal scroll) ──────────── */}
      {bankAccountBalances.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x">
          {bankAccountBalances.map((bank, i) => (
            <BalanceCard
              key={`${bank.bankName}_${bank.accountEnding}_${i}`}
              {...bank}
              formatMoney={formatMoney}
              adjustBankBalance={adjustBankBalance}
            />
          ))}
        </div>
      )}
    </div>
  );
}
