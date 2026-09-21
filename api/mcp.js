// ─────────────────────────────────────────────────────────────────────────────
//  Budget Tracker — Remote MCP Server
//  Hosted on Vercel at /api/mcp
//
//  Transport: Streamable HTTP (JSON-RPC 2.0 over HTTPS POST)
//  Compatible with: Claude Desktop, Claude Web (claude.ai), Claude Mobile
//
//  Required Vercel Environment Variables:
//    MCP_API_KEY   — secret token you configure in Claude connector settings
//    MCP_USER_UID  — your Firebase UID (e.g. do139V31SkRXMSpkLIW1AroA9ZO2)
//    FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//      (already set for payment APIs — reused here)
// ─────────────────────────────────────────────────────────────────────────────

import { adminDb } from './_lib/firebaseAdmin.js';

const MCP_API_KEY  = process.env.MCP_API_KEY;
const MCP_USER_UID = process.env.MCP_USER_UID;

// ─── CORS ────────────────────────────────────────────────────────────────────
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-api-key, mcp-session-id');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ─── MCP TOOL DEFINITIONS ────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'get_balances',
    description:
      'Get the current financial snapshot: total balance, individual bank account balances, cash balance, monthly budget, and subscription plan.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_transactions',
    description:
      'Search and filter transactions. Returns a formatted list including date, type, amount, category, description, and bank.',
    inputSchema: {
      type: 'object',
      properties: {
        limit:     { type: 'number',  description: 'Max transactions to return (default 20, max 100)' },
        type:      { type: 'string',  enum: ['income', 'expense', 'savings', 'debt'], description: 'Filter by transaction type' },
        category:  { type: 'string',  description: 'Filter by category name (partial, case-insensitive)' },
        bank:      { type: 'string',  description: 'Filter by bank name (e.g. "Canara Bank", "Indian Bank")' },
        search:    { type: 'string',  description: 'Full-text search in description' },
        from_date: { type: 'string',  description: 'Start date filter in YYYY-MM-DD format' },
        to_date:   { type: 'string',  description: 'End date filter in YYYY-MM-DD format' },
      },
    },
  },
  {
    name: 'get_monthly_summary',
    description:
      'Get a financial summary for a specific month: total income, expenses, savings, net, top spending categories, and budget health.',
    inputSchema: {
      type: 'object',
      properties: {
        month: { type: 'number', description: 'Month (1-12). Defaults to current month.' },
        year:  { type: 'number', description: 'Year (e.g. 2026). Defaults to current year.' },
      },
    },
  },
  {
    name: 'add_transaction',
    description:
      'Add a new transaction to Budget Tracker. Returns confirmation with the saved transaction details.',
    inputSchema: {
      type: 'object',
      properties: {
        type:         { type: 'string', enum: ['income', 'expense', 'savings', 'debt'], description: 'Transaction type' },
        amount:       { type: 'number', description: 'Amount in Indian Rupees (₹)' },
        description:  { type: 'string', description: 'Short description (e.g. "Swiggy lunch", "Auto rickshaw")' },
        category_name:{ type: 'string', description: 'Category name (e.g. Food, Transport, Salary). Auto-matched to existing categories.' },
        date:         { type: 'string', description: 'Date in YYYY-MM-DD format. Defaults to today.' },
        payment_mode: { type: 'string', enum: ['upi', 'cash', 'card', 'bank_transfer', 'other'], description: 'How payment was made' },
      },
      required: ['type', 'amount', 'description'],
    },
  },
  {
    name: 'list_categories',
    description:
      'List all budget categories with monthly budget vs current month spending and remaining budget.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense', 'savings', 'debt'], description: 'Filter by category type' },
      },
    },
  },
  {
    name: 'get_loans_and_recurring',
    description:
      'Get active loans (EMI details, remaining balance, interest rate) and recurring bills/subscriptions (next due date, amount, frequency).',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

// ─── FIRESTORE HELPER ────────────────────────────────────────────────────────
async function getUserData() {
  const db = await adminDb();
  if (!db) throw new Error('Firebase Admin not configured. Check FIREBASE_* env vars in Vercel.');
  const snap = await db.collection('users').doc(MCP_USER_UID).get();
  if (!snap.exists) throw new Error(`No user document found for UID: ${MCP_USER_UID}`);
  return snap.data();
}

// ─── CURRENCY FORMATTER ──────────────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ─── TOOL: get_balances ───────────────────────────────────────────────────────
async function handleGetBalances() {
  const data = await getUserData();
  const { transactions = [], initialBankBalances = {}, initialCashBalance = 0,
          cashSeedDate, accountingStartDate, monthlyBudget = 0, subscription = 'free',
          profile = {} } = data;

  // Compute bank balances
  const bankMap = {};
  Object.entries(initialBankBalances).forEach(([key, seed]) => {
    const [bankName, accountEnding] = key.split('_');
    bankMap[key] = {
      bankName, accountEnding,
      balance: parseFloat(seed.amount) || 0,
      seedDate: seed.date ? new Date(seed.date) : null,
    };
  });

  const effectiveStart = accountingStartDate ? new Date(accountingStartDate) : null;

  transactions.forEach(t => {
    if (!t.bankName || !t.accountEnding) return;
    if (t.bankName === 'GPay/UPI' || t.bankName === 'PhonePe') return;
    const key = `${t.bankName}_${t.accountEnding}`;
    const entry = bankMap[key];
    if (!entry) return;
    const tDate = new Date(t.date);
    if (effectiveStart && tDate < effectiveStart) return;
    if (entry.seedDate && tDate < entry.seedDate) return;
    if (t.type === 'income') entry.balance += (t.amount || 0);
    else if (t.type === 'expense' || t.type === 'debt') entry.balance -= (t.amount || 0);
  });

  // Compute cash balance
  const seedLimit = cashSeedDate ? new Date(cashSeedDate) : null;
  const startLimit = effectiveStart;
  const limit = [seedLimit, startLimit].filter(Boolean).sort((a,b) => b - a)[0];

  const isAtm = t => {
    const d = (t.description || '').toLowerCase();
    return t.type === 'expense' && (d.includes('atm wdl') || d.includes('cash withdrawal') || d.includes('atm cash'));
  };

  let cashBalance = parseFloat(initialCashBalance) || 0;
  transactions
    .filter(t => !limit || new Date(t.date) >= limit)
    .forEach(t => {
      if (t.type === 'income' && t.paymentMode === 'cash') cashBalance += t.amount;
      else if (isAtm(t)) cashBalance += t.amount;
      else if ((t.type === 'expense' || t.type === 'debt') && t.paymentMode === 'cash' && !isAtm(t)) cashBalance -= t.amount;
    });

  const bankTotal = Object.values(bankMap).reduce((s, b) => s + b.balance, 0);
  const totalBalance = bankTotal + cashBalance;

  // Monthly spend this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date) >= monthStart)
    .reduce((s, t) => s + (t.amount || 0), 0);

  const lines = [
    `💰 BUDGET TRACKER — FINANCIAL SNAPSHOT`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 ${profile.firstName || 'User'} ${profile.lastName || ''}  |  Plan: ${subscription.toUpperCase()}`,
    ``,
    `📊 TOTAL BALANCE: ${fmt(totalBalance)}`,
    ``,
    `🏦 BANK ACCOUNTS:`,
    ...Object.values(bankMap).map(b =>
      `   • ${b.bankName} (****${b.accountEnding}): ${fmt(b.balance)}`),
    Object.values(bankMap).length === 0 ? `   (No bank accounts linked yet)` : '',
    ``,
    `💵 CASH BALANCE: ${fmt(cashBalance)}`,
    ``,
    `📅 THIS MONTH (${now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}):`,
    `   • Monthly Budget:   ${fmt(monthlyBudget)}`,
    `   • Spent so far:     ${fmt(thisMonthExpenses)}`,
    `   • Remaining:        ${fmt(Math.max(0, monthlyBudget - thisMonthExpenses))}`,
    `   • Budget used:      ${monthlyBudget > 0 ? Math.round((thisMonthExpenses / monthlyBudget) * 100) : 0}%`,
  ].filter(l => l !== '').join('\n');

  return lines;
}

// ─── TOOL: get_transactions ───────────────────────────────────────────────────
async function handleGetTransactions(args = {}) {
  const data = await getUserData();
  const { transactions = [], categories = [] } = data;
  const { limit = 20, type, category, bank, search, from_date, to_date } = args;

  const catMap = {};
  categories.forEach(c => { catMap[String(c.id)] = c; });

  const getCatName = (id) => catMap[String(id)]?.name || 'Uncategorised';

  let filtered = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (type) filtered = filtered.filter(t => t.type === type);
  if (bank) filtered = filtered.filter(t => (t.bankName || '').toLowerCase().includes(bank.toLowerCase()));
  if (search) filtered = filtered.filter(t => (t.description || '').toLowerCase().includes(search.toLowerCase()));
  if (category) {
    filtered = filtered.filter(t => {
      const catName = getCatName(t.categoryId);
      return catName.toLowerCase().includes(category.toLowerCase());
    });
  }
  if (from_date) {
    const from = new Date(from_date);
    filtered = filtered.filter(t => new Date(t.date) >= from);
  }
  if (to_date) {
    const to = new Date(to_date + 'T23:59:59');
    filtered = filtered.filter(t => new Date(t.date) <= to);
  }

  const capped = filtered.slice(0, Math.min(Number(limit), 100));

  if (capped.length === 0) {
    return `No transactions found matching your filters.`;
  }

  const icon = t => ({ income: '🟢', expense: '🔴', savings: '🔵', debt: '🟠' }[t.type] || '⚪');

  const lines = [
    `📋 TRANSACTIONS (${capped.length} of ${filtered.length} matching)`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ...capped.map(t => {
      const d = new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
      const cat = getCatName(t.categoryId);
      const bank = t.bankName ? ` | ${t.bankName}` : '';
      const mode = t.paymentMode ? ` [${t.paymentMode.toUpperCase()}]` : '';
      return `${icon(t)} ${d}  ${fmt(t.amount).padEnd(12)}  ${cat.padEnd(14)}  ${(t.description || '').substring(0, 35)}${bank}${mode}`;
    }),
    ``,
    `Total: ${fmt(capped.reduce((s, t) => t.type === 'expense' ? s + t.amount : s - t.amount, 0))} net`,
  ];

  return lines.join('\n');
}

// ─── TOOL: get_monthly_summary ────────────────────────────────────────────────
async function handleGetMonthlySummary(args = {}) {
  const data = await getUserData();
  const { transactions = [], categories = [], monthlyBudget = 0 } = data;

  const now = new Date();
  const month = args.month ? Number(args.month) : now.getMonth() + 1;
  const year  = args.year  ? Number(args.year)  : now.getFullYear();

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59);

  const catMap = {};
  categories.forEach(c => { catMap[String(c.id)] = c; });

  const monthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d >= monthStart && d <= monthEnd;
  });

  const income   = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savings  = monthTx.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
  const debt     = monthTx.filter(t => t.type === 'debt').reduce((s, t) => s + t.amount, 0);
  const net      = income - expenses - savings - debt;

  // Category breakdown for expenses
  const catSpend = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    const name = catMap[String(t.categoryId)]?.name || 'Uncategorised';
    catSpend[name] = (catSpend[name] || 0) + t.amount;
  });
  const topCats = Object.entries(catSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const monthLabel = monthStart.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const lines = [
    `📊 MONTHLY SUMMARY — ${monthLabel}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🟢 Total Income:    ${fmt(income)}`,
    `🔴 Total Expenses:  ${fmt(expenses)}`,
    `🔵 Total Savings:   ${fmt(savings)}`,
    `🟠 Debt Payments:   ${fmt(debt)}`,
    ``,
    `💡 Net Cash Flow:   ${fmt(net)}  (${net >= 0 ? '✅ surplus' : '⚠️ deficit'})`,
    monthlyBudget > 0 ? `📅 Monthly Budget:  ${fmt(monthlyBudget)}  |  Used: ${Math.round((expenses/monthlyBudget)*100)}%` : '',
    ``,
    `🏆 TOP SPENDING CATEGORIES:`,
    ...topCats.map(([name, amt], i) => {
      const pct = expenses > 0 ? Math.round((amt / expenses) * 100) : 0;
      const catBudget = categories.find(c => c.name === name)?.budget || 0;
      const over = catBudget > 0 && amt > catBudget ? ' ⚠️ OVER BUDGET' : '';
      return `   ${i + 1}. ${name.padEnd(18)} ${fmt(amt).padEnd(12)} (${pct}%)${over}`;
    }),
    topCats.length === 0 ? '   No expense transactions this month.' : '',
    ``,
    `📝 Total transactions: ${monthTx.length}`,
  ].filter(l => l !== '').join('\n');

  return lines;
}

// ─── TOOL: add_transaction ────────────────────────────────────────────────────
async function handleAddTransaction(args = {}) {
  const { type, amount, description, category_name, date, payment_mode } = args;

  if (!type || !amount || !description) {
    throw new Error('type, amount, and description are required.');
  }
  if (!['income', 'expense', 'savings', 'debt'].includes(type)) {
    throw new Error('type must be one of: income, expense, savings, debt');
  }
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('amount must be a positive number');
  }

  const data = await getUserData();
  const { categories = [], transactions = [] } = data;

  // Match category
  let categoryId = null;
  if (category_name) {
    const match = categories.find(c =>
      c.name.toLowerCase() === category_name.toLowerCase() ||
      c.name.toLowerCase().includes(category_name.toLowerCase())
    );
    if (match) categoryId = String(match.id);
  }

  const txDate = date
    ? new Date(date).toISOString()
    : new Date().toISOString();

  // Generate a simple unique ID
  const newId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const newTx = {
    id: newId,
    type,
    amount: Number(amount),
    description: description.trim(),
    date: txDate,
    categoryId,
    paymentMode: payment_mode || 'other',
    source: 'mcp',
    createdAt: new Date().toISOString(),
  };

  const db = await adminDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  await db.collection('users').doc(MCP_USER_UID).update({
    transactions: [...transactions, newTx],
  });

  const catName = categories.find(c => String(c.id) === categoryId)?.name || 'Uncategorised';

  return [
    `✅ TRANSACTION ADDED SUCCESSFULLY`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Type:         ${type.charAt(0).toUpperCase() + type.slice(1)}`,
    `Amount:       ${fmt(amount)}`,
    `Description:  ${description}`,
    `Category:     ${catName}`,
    `Date:         ${new Date(txDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    `Payment:      ${payment_mode || 'other'}`,
    `ID:           ${newId}`,
    ``,
    `The transaction is now saved in your Budget Tracker and will appear on the app on next refresh.`,
  ].join('\n');
}

// ─── TOOL: list_categories ────────────────────────────────────────────────────
async function handleListCategories(args = {}) {
  const data = await getUserData();
  const { categories = [], transactions = [] } = data;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // This month spending per category
  const catSpend = {};
  transactions
    .filter(t => new Date(t.date) >= monthStart)
    .forEach(t => {
      const id = String(t.categoryId);
      catSpend[id] = (catSpend[id] || 0) + (t.amount || 0);
    });

  let filtered = categories;
  if (args.type) filtered = categories.filter(c => c.type === args.type);

  const groups = { income: [], expense: [], savings: [], debt: [] };
  filtered.forEach(c => { (groups[c.type] || groups.expense).push(c); });

  const typeIcon = { income: '🟢', expense: '🔴', savings: '🔵', debt: '🟠' };

  const lines = [
    `📂 BUDGET CATEGORIES`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ];

  for (const [catType, cats] of Object.entries(groups)) {
    if (cats.length === 0) continue;
    lines.push(``, `${typeIcon[catType]} ${catType.toUpperCase()} CATEGORIES:`);
    cats.forEach(c => {
      const spent = catSpend[String(c.id)] || 0;
      const budget = c.budget || 0;
      const remaining = budget > 0 ? budget - spent : null;
      const status = remaining === null
        ? ''
        : remaining < 0 ? ` ⚠️ OVER by ${fmt(Math.abs(remaining))}`
        : ` (${fmt(remaining)} left)`;
      const budgetStr = budget > 0 ? `Budget: ${fmt(budget)}  Spent: ${fmt(spent)}${status}` : `No budget set  |  Spent: ${fmt(spent)}`;
      lines.push(`   • ${c.name.padEnd(20)} ${budgetStr}`);
    });
  }

  lines.push(``, `Total categories: ${filtered.length}`);
  return lines.join('\n');
}

// ─── TOOL: get_loans_and_recurring ───────────────────────────────────────────
async function handleGetLoansAndRecurring() {
  const data = await getUserData();
  const { loans = [], recurring = [], categories = [] } = data;

  const catMap = {};
  categories.forEach(c => { catMap[String(c.id)] = c; });

  const lines = [`💳 LOANS & RECURRING BILLS`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`];

  // Loans
  if (loans.length > 0) {
    lines.push(``, `🏦 ACTIVE LOANS (${loans.length}):`);
    loans.forEach(l => {
      lines.push(
        ``,
        `   📌 ${l.name || l.type || 'Loan'}`,
        `   • Total Amount:     ${fmt(l.totalAmount || l.principalAmount)}`,
        `   • Remaining:        ${fmt(l.remainingAmount)}`,
        `   • Monthly EMI:      ${fmt(l.emi || l.monthlyPayment)}`,
        l.interestRate ? `   • Interest Rate:    ${l.interestRate}% p.a.` : '',
        l.dueDate ? `   • Due Date:         ${new Date(l.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : '',
      ).filter(Boolean);
    });
    const totalEmi = loans.reduce((s, l) => s + (l.emi || l.monthlyPayment || 0), 0);
    lines.push(``, `   📊 Total Monthly EMI: ${fmt(totalEmi)}`);
  } else {
    lines.push(``, `   No active loans recorded.`);
  }

  // Recurring
  if (recurring.length > 0) {
    lines.push(``, `🔄 RECURRING BILLS & SUBSCRIPTIONS (${recurring.length}):`);
    recurring
      .sort((a, b) => {
        if (!a.nextDue) return 1;
        if (!b.nextDue) return -1;
        return new Date(a.nextDue) - new Date(b.nextDue);
      })
      .forEach(r => {
        const nextDue = r.nextDue ? new Date(r.nextDue).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A';
        const cat = catMap[String(r.categoryId)]?.name || '';
        const freq = r.frequency || 'monthly';
        const icon = r.type === 'income' ? '🟢' : '🔴';
        lines.push(`   ${icon} ${(r.description || r.name || 'Recurring').padEnd(22)} ${fmt(r.amount).padEnd(12)} Next: ${nextDue}  [${freq}]${cat ? `  (${cat})` : ''}`);
      });

    const totalOut = recurring.filter(r => r.type !== 'income').reduce((s, r) => s + (r.amount || 0), 0);
    const totalIn = recurring.filter(r => r.type === 'income').reduce((s, r) => s + (r.amount || 0), 0);
    lines.push(``, `   📊 Monthly Outflow: ${fmt(totalOut)}   Monthly Inflow: ${fmt(totalIn)}`);
  } else {
    lines.push(``, `   No recurring bills recorded.`);
  }

  return lines.join('\n');
}

// ─── JSON-RPC DISPATCHER ─────────────────────────────────────────────────────
async function handleJsonRpc(request) {
  const { jsonrpc, method, params, id } = request || {};

  const ok  = (result)  => ({ jsonrpc: '2.0', id: id ?? null, result });
  const err = (code, msg) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message: msg } });

  // Notifications have no id — return null (no response)
  if (id === undefined && method?.startsWith('notifications/')) return null;

  try {
    switch (method) {

      case 'initialize':
        return ok({
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'budget-tracker-mcp', version: '1.0.0' },
        });

      case 'notifications/initialized':
        return null;

      case 'ping':
        return ok({});

      case 'tools/list':
        return ok({ tools: TOOLS });

      case 'tools/call': {
        const { name, arguments: args } = params || {};
        let text;

        switch (name) {
          case 'get_balances':          text = await handleGetBalances(); break;
          case 'get_transactions':      text = await handleGetTransactions(args); break;
          case 'get_monthly_summary':   text = await handleGetMonthlySummary(args); break;
          case 'add_transaction':       text = await handleAddTransaction(args); break;
          case 'list_categories':       text = await handleListCategories(args); break;
          case 'get_loans_and_recurring': text = await handleGetLoansAndRecurring(); break;
          default:
            return err(-32601, `Unknown tool: ${name}`);
        }

        return ok({ content: [{ type: 'text', text }] });
      }

      default:
        return err(-32601, `Method not found: ${method}`);
    }
  } catch (e) {
    console.error('[MCP] Tool error:', e.message);
    return err(-32603, e.message || 'Internal error');
  }
}

// ─── MAIN VERCEL HANDLER ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCorsHeaders(res);

  // Preflight
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!MCP_API_KEY) {
    return res.status(500).json({ error: 'MCP_API_KEY not configured on server.' });
  }
  if (!MCP_USER_UID) {
    return res.status(500).json({ error: 'MCP_USER_UID not configured on server.' });
  }

  const authHeader = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  const xApiKey    = (req.headers['x-api-key'] || '').trim();
  // Also accept key as URL query param: /api/mcp?key=xxx
  // This enables Claude's "No sign-in" connector mode where headers can't be set
  const queryKey   = (req.query?.key || '').trim();
  const providedKey = authHeader || xApiKey || queryKey;

  if (!providedKey || providedKey !== MCP_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key.' });
  }

  // ── GET — simple health check (some MCP clients ping via GET) ─────────────
  if (req.method === 'GET') {
    return res.status(200).json({
      name: 'budget-tracker-mcp',
      version: '1.0.0',
      description: 'Budget Tracker MCP Server',
      tools: TOOLS.map(t => t.name),
      status: 'ok',
    });
  }

  // ── POST — JSON-RPC 2.0 ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;
    if (!body) return res.status(400).json({ error: 'Request body is empty.' });

    // Handle both single requests and batches
    const requests = Array.isArray(body) ? body : [body];
    const responses = [];

    for (const request of requests) {
      const response = await handleJsonRpc(request);
      if (response !== null) responses.push(response);
    }

    if (responses.length === 0) return res.status(204).end();
    if (!Array.isArray(body) && responses.length === 1) return res.status(200).json(responses[0]);
    return res.status(200).json(responses);
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
