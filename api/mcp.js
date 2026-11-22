// ─────────────────────────────────────────────────────────────────────────────
//  Budget Tracker — Remote MCP Server
//  Hosted on Vercel at /api/mcp
//
//  Transport: Streamable HTTP (JSON-RPC 2.0 over HTTPS POST)
//  Compatible with: Claude Desktop, Claude Web (claude.ai), Claude Mobile
//
//  Required Vercel Environment Variables:
//    MCP_API_KEY            — secret token for Claude connector
//    MCP_USER_UID           — your Firebase UID in listing-generator-31b39
//    MCP_FIREBASE_PROJECT_ID   — from listing-generator-31b39 service account
//    MCP_FIREBASE_CLIENT_EMAIL — from listing-generator-31b39 service account
//    MCP_FIREBASE_PRIVATE_KEY  — from listing-generator-31b39 service account
// ─────────────────────────────────────────────────────────────────────────────

import { verifyAccessToken } from './_lib/oauthTokens.js';
import { checkMcpRateLimit, globalRateLimiter } from './_lib/rateLimiter.js';

const MCP_API_KEY  = process.env.MCP_API_KEY;

const DEFAULT_SURESH_UID = 'mlbLQkDo0Ef95hns8p8iTkQdUK83';
const DEFAULT_ROSIE_UID  = 'do139V31SkRXMSpkLIW1AroA9ZO2';

function resolveTargetUid(req) {
  const queryUid = (req?.query?.uid || '').trim();
  if (queryUid) return queryUid;

  const userParam = (req?.query?.user || '').trim().toLowerCase();
  if (userParam === 'rosie') {
    return process.env.ROSIE_USER_UID || DEFAULT_ROSIE_UID;
  }
  if (userParam === 'suresh' || userParam === 'default') {
    return process.env.SURESH_USER_UID || DEFAULT_SURESH_UID;
  }

  return process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
}

// ─── Dedicated MCP Firebase Admin (always uses listing-generator-31b39) ───────
// Uses MCP_FIREBASE_* vars first, falls back to FIREBASE_* only if the
// project id already matches the expected Budget Tracker project.
const BUDGET_TRACKER_PROJECT = 'listing-generator-31b39';
let _mcpDb = null;

async function getMcpDb() {
  if (_mcpDb) return _mcpDb;

  const projectId   = process.env.MCP_FIREBASE_PROJECT_ID   || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.MCP_FIREBASE_CLIENT_EMAIL  || process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey      = process.env.MCP_FIREBASE_PRIVATE_KEY   || process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error('Missing Firebase Admin credentials. Set MCP_FIREBASE_PROJECT_ID, MCP_FIREBASE_CLIENT_EMAIL, MCP_FIREBASE_PRIVATE_KEY in Vercel.');
  }

  if (projectId !== BUDGET_TRACKER_PROJECT) {
    throw new Error(
      `Wrong Firebase project! Admin SDK is using "${projectId}" but Budget Tracker data lives in "${BUDGET_TRACKER_PROJECT}". ` +
      `Add service account from ${BUDGET_TRACKER_PROJECT} Firebase Console as MCP_FIREBASE_PROJECT_ID / MCP_FIREBASE_CLIENT_EMAIL / MCP_FIREBASE_PRIVATE_KEY in Vercel.`
    );
  }

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    // Use a named app so it doesn't collide with the payment Admin SDK instance
    const appName = 'mcp-budget-tracker';
    const existing = getApps().find(a => a.name === appName);
    const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
    const app = existing || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, appName);
    _mcpDb = getFirestore(app);
    return _mcpDb;
  } catch (e) {
    throw new Error(`Firebase Admin init failed: ${e.message}`);
  }
}


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
    name: 'get_profile',
    title: 'Get Profile, Subscription Plan & Team Info',
    description:
      'Get the authenticated user\'s profile details (profile name, email, user ID), subscription plan details (Free, Starter, Pro, trial days remaining, pricing, member limits, transaction limits, and unlocked features), and team / household information (team name, role, member count, members list). Call this whenever asked for user name, profile name, team name, subscription plan, plan tier, or household info.',
    annotations: { readOnlyHint: true, destructiveHint: false },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_balances',
    title: 'Get Financial Snapshot & Balances',
    description:
      'Get the current financial snapshot: total balance, individual bank account balances, cash balance, monthly budget, and subscription plan.',
    annotations: { readOnlyHint: true, destructiveHint: false },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_transactions',
    title: 'Search Transactions',
    description:
      'Search and filter transactions. Returns a formatted list including date, type, amount, category, description, and bank.',
    annotations: { readOnlyHint: true, destructiveHint: false },
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
    title: 'Monthly Summary & Spending Breakdown',
    description:
      'Get a financial summary for a specific month: total income, expenses, savings, net, top spending categories, and budget health.',
    annotations: { readOnlyHint: true, destructiveHint: false },
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
    title: 'Add New Transaction',
    description:
      'Add a new transaction to Budget Tracker. Returns confirmation with the saved transaction details.',
    annotations: { readOnlyHint: false, destructiveHint: false },
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
    title: 'List Budget Categories',
    description:
      'List all budget categories with monthly budget vs current month spending and remaining budget.',
    annotations: { readOnlyHint: true, destructiveHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense', 'savings', 'debt'], description: 'Filter by category type' },
      },
    },
  },
  {
    name: 'add_category',
    title: 'Create Category',
    description:
      'Create a new budget category. Type must be income, expense, savings, or debt. You can optionally set a monthly budget limit.',
    annotations: { readOnlyHint: false, destructiveHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        name:   { type: 'string', description: 'Name of the category (e.g. Groceries, Gym, OTT Subscriptions)' },
        type:   { type: 'string', enum: ['income', 'expense', 'savings', 'debt'], description: 'Category type (default: expense)' },
        budget: { type: 'number', description: 'Monthly budget allocation in ₹ (optional, default: 0)' },
        color:  { type: 'string', description: 'Hex color code (e.g. "#f59e0b", optional)' },
        icon:   { type: 'string', description: 'Lucide icon name (e.g. "ShoppingBag", "Utensils", "Zap", optional)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'edit_category',
    title: 'Edit Category',
    description:
      'Update an existing category: rename it, change its monthly budget limit, change color, or change icon. Identify category by name or ID.',
    annotations: { readOnlyHint: false, destructiveHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category name or ID to edit (case-insensitive search)' },
        new_name: { type: 'string', description: 'New name for the category (optional)' },
        budget:   { type: 'number', description: 'New monthly budget in ₹ (optional)' },
        color:    { type: 'string', description: 'New hex color code (optional)' },
        icon:     { type: 'string', description: 'New Lucide icon name (optional)' },
      },
      required: ['category'],
    },
  },
  {
    name: 'delete_category',
    title: 'Delete Category',
    description:
      'Delete an existing category by its name or ID.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category name or ID to delete' },
      },
      required: ['category'],
    },
  },
  {
    name: 'get_loans_and_recurring',
    title: 'Get Loans, EMIs & Recurring Subscriptions',
    description:
      'Get active loans (EMI details, remaining balance, interest rate) and recurring bills/subscriptions (next due date, amount, frequency).',
    annotations: { readOnlyHint: true, destructiveHint: false },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'set_bank_balance',
    title: 'Set Bank Account Balance',
    description: 'Set or update the starting/current balance of a bank account (e.g. Indian Bank, Canara Bank, SBI, HDFC).',
    annotations: { readOnlyHint: false, destructiveHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        bank_name:      { type: 'string', description: 'Bank name (e.g. "Indian Bank", "Canara Bank", "SBI")' },
        amount:         { type: 'number', description: 'Current available balance in ₹' },
        account_ending: { type: 'string', description: 'Last 4 digits or "primary" (default: "primary")' },
      },
      required: ['bank_name', 'amount'],
    },
  },
  {
    name: 'set_cash_balance',
    title: 'Set Cash on Hand',
    description: 'Set or update the physical cash-in-hand balance.',
    annotations: { readOnlyHint: false, destructiveHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Current physical cash amount in ₹' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'set_monthly_budget',
    title: 'Set Overall Monthly Budget',
    description: 'Set or update the overall monthly spending budget (e.g. ₹20,000).',
    annotations: { readOnlyHint: false, destructiveHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Total monthly budget in ₹ (e.g. 20000)' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'add_lent',
    title: 'Record Money Lent to Friend',
    description: 'Record money lent to a friend or relative that they need to return (e.g. Dhilip ₹1,000, Mani ₹1,500).',
    annotations: { readOnlyHint: false, destructiveHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        name:     { type: 'string', description: 'Friend or person name (e.g. "Dhilip", "Mani")' },
        amount:   { type: 'number', description: 'Amount lent in ₹' },
        note:     { type: 'string', description: 'Optional note / reason (e.g. "Emergency", "Petrol")' },
        due_date: { type: 'string', description: 'Expected return date (YYYY-MM-DD)' },
      },
      required: ['name', 'amount'],
    },
  },
  {
    name: 'settle_lent',
    title: 'Mark Lent Money as Received / Settled',
    description: 'Mark money previously lent to a friend as returned/received. Automatically creates an income entry in transactions and adds to balance.',
    annotations: { readOnlyHint: false, destructiveHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        name:   { type: 'string', description: 'Friend name (e.g. "Dhilip", "Mani") or lent entry ID' },
        amount: { type: 'number', description: 'Amount returned in ₹ (optional, defaults to full principal)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_transaction',
    title: 'Delete Transaction',
    description: 'Delete a transaction from the ledger by ID, or delete the latest transaction, or search by description and amount.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        id:          { type: 'string',  description: 'Transaction ID to delete' },
        latest:      { type: 'boolean', description: 'Set to true to delete the most recent transaction' },
        search:      { type: 'string',  description: 'Keyword search for transaction to remove' },
        amount:      { type: 'number',  description: 'Amount of transaction to remove' },
      },
    },
  },
  {
    name: 'add_recurring',
    title: 'Add Recurring Bill or Subscription',
    description: 'Add a recurring subscription or bill (e.g. Netflix ₹199/mo, EB Bill ₹500, Rent ₹8,000).',
    annotations: { readOnlyHint: false, destructiveHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        name:          { type: 'string', description: 'Name of the bill/subscription' },
        amount:        { type: 'number', description: 'Amount in ₹' },
        frequency:     { type: 'string', enum: ['monthly', 'weekly', 'daily'], description: 'Frequency (default: "monthly")' },
        category_name: { type: 'string', description: 'Category name (optional)' },
      },
      required: ['name', 'amount'],
    },
  },
  {
    name: 'delete_recurring',
    title: 'Delete Recurring Bill or Subscription',
    description: 'Delete an active recurring bill or subscription by name or ID.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name or ID of the recurring item to delete' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_loan',
    title: 'Add Borrowing Loan / EMI',
    description: 'Record an EMI or money borrowed that the user owes (e.g. Bike loan EMI, personal loan).',
    annotations: { readOnlyHint: false, destructiveHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        name:           { type: 'string', description: 'Loan or lender name (e.g. "HDFC Bike Loan")' },
        type:           { type: 'string', enum: ['emi', 'debt'], description: 'Type: "emi" for monthly installment, "debt" for lump sum borrowing' },
        principal:      { type: 'number', description: 'Total loan principal amount in ₹' },
        monthly_amount: { type: 'number', description: 'Monthly EMI installment in ₹' },
        tenure:         { type: 'number', description: 'Tenure in months (for EMI)' },
        interest_rate:  { type: 'number', description: 'Annual interest rate % (optional)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_loan',
    title: 'Delete Loan or Borrowing',
    description: 'Delete a loan or debt entry by name or ID.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name or ID of the loan to delete' },
      },
      required: ['name'],
    },
  },
];

// ─── FIRESTORE HELPER ────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: "1",  name: "Salary",         type: "income",  color: "#10b981", icon: "Wallet",      budget: 0   },
  { id: "2",  name: "Freelance",      type: "income",  color: "#3b82f6", icon: "Laptop",      budget: 0   },
  { id: "3",  name: "Food",           type: "expense", color: "#f59e0b", icon: "Utensils",    budget: 500 },
  { id: "4",  name: "Transport",      type: "expense", color: "#ef4444", icon: "Car",         budget: 200 },
  { id: "5",  name: "Utilities",      type: "expense", color: "#6366f1", icon: "Zap",         budget: 150 },
  { id: "6",  name: "Emergency Fund", type: "savings", color: "#06b6d4", icon: "ShieldCheck", budget: 0   },
  { id: "7",  name: "Credit Card",    type: "debt",    color: "#f97316", icon: "CreditCard",  budget: 0   },
  { id: "8",  name: "Clothes",        type: "expense", color: "#ec4899", icon: "ShoppingBag", budget: 100 },
  { id: "9",  name: "Coffee",         type: "expense", color: "#8b5cf6", icon: "Coffee",      budget: 50  },
  { id: "10", name: "Beauty",         type: "expense", color: "#f472b6", icon: "Sparkles",    budget: 0   },
  { id: "11", name: "Entertainment",  type: "expense", color: "#14b8a6", icon: "Clapperboard",budget: 100 },
];

async function getUserData(targetUid) {
  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured. Check MCP_FIREBASE_* env vars in Vercel.');
  
  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  
  let data;
  if (!snap.exists) {
    // Auto-bootstrap default user document so new accounts or unseeded accounts work instantly!
    const defaultData = {
      categories: DEFAULT_CATEGORIES,
      transactions: [],
      subscription: "trial",
      monthlyBudget: 50000,
      initialBankBalances: {},
      initialCashBalance: 0,
      recurring: [],
      loans: [],
      profile: { profileComplete: true, categoriesSelected: true },
      createdAt: new Date().toISOString(),
    };
    await userRef.set(defaultData, { merge: true });
    data = defaultData;
  } else {
    data = snap.data();
  }

  // If user belongs to a household, pull shared fields from households/{householdId}
  let householdId = data.householdId;
  let householdDoc = null;
  try {
    if (householdId) {
      householdDoc = await db.collection('households').doc(householdId).get().catch(() => null);
    } else {
      const hQuery = await db.collection('households').where('memberIds', 'array-contains', uid).limit(1).get().catch(() => null);
      if (hQuery && !hQuery.empty) {
        householdDoc = hQuery.docs[0];
        householdId = householdDoc.id;
        data.householdId = householdId;
      }
    }

    if (householdDoc && householdDoc.exists) {
      const hData = householdDoc.data();
      if (Array.isArray(hData.transactions) && hData.transactions.length > 0) {
        data.transactions = hData.transactions;
      }
      if (Array.isArray(hData.categories) && hData.categories.length > 0) {
        data.categories = hData.categories;
      }
      if (hData.recurring && Array.isArray(hData.recurring) && hData.recurring.length > 0) {
        data.recurring = hData.recurring;
      }
      if (hData.loans && Array.isArray(hData.loans) && hData.loans.length > 0) {
        data.loans = hData.loans;
      }
      if (hData.monthlyBudget) data.monthlyBudget = hData.monthlyBudget;
      if (hData.accountingStartDate) data.accountingStartDate = hData.accountingStartDate;

      const memberEntry = hData.members?.[uid];
      if (memberEntry) {
        if (memberEntry.initialBankBalances && Object.keys(memberEntry.initialBankBalances).length > 0) {
          data.initialBankBalances = { ...memberEntry.initialBankBalances, ...(data.initialBankBalances || {}) };
        }
        if (memberEntry.initialCashBalance !== undefined && !data.initialCashBalance) {
          data.initialCashBalance = memberEntry.initialCashBalance;
        }
      }
    }
  } catch (hErr) {
    console.warn('[MCP] Household merge warning in getUserData:', hErr.message);
  }

  // Ensure categories exists
  if (!data.categories || !Array.isArray(data.categories) || data.categories.length === 0) {
    data.categories = DEFAULT_CATEGORIES;
    await userRef.set({ categories: DEFAULT_CATEGORIES }, { merge: true }).catch(() => {});
  }
  return data;
}

// ─── CURRENCY FORMATTER ──────────────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ─── SUBSCRIPTION & PLAN DETAILS HELPER ──────────────────────────────────────
function getPlanDetails(subscription = 'free', trialEndDate = null) {
  const sub = String(subscription || 'free').toLowerCase();

  let remainingDays = null;
  if (sub === 'trial' && trialEndDate) {
    const end = new Date(trialEndDate);
    const now = new Date();
    remainingDays = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  }

  if (sub === 'starter') {
    return {
      tier: 'starter',
      name: 'Starter Plan',
      price: '₹9 / month',
      status: 'Active (Subscribed)',
      isPro: false,
      memberLimit: 2,
      memberLimitDesc: '2 Members (Owner + 1 Invited partner)',
      txLimit: 'Unlimited',
      features: [
        'Unlimited monthly transactions',
        '2 Members (Owner + 1 Invited partner)',
        'Multiple Banks & Cash Wallet tracking',
        'Statement PDF & CSV auto-import',
        'CSV / Excel export',
        'Category budgets & alerts',
      ],
      description: 'Starter Plan (₹9/mo) — 2 members max, unlimited transactions, bank statement PDF & CSV import.',
    };
  }

  if (sub === 'trial') {
    const daysText = remainingDays !== null ? `${remainingDays} days remaining` : '90 days free trial active';
    return {
      tier: 'trial',
      name: 'Pro Plan (90-Day Free Trial)',
      price: '₹0 (Regular ₹100 / month)',
      status: `Active Free Trial (${daysText})`,
      remainingDays: remainingDays !== null ? remainingDays : 90,
      isPro: true,
      memberLimit: 4,
      memberLimitDesc: '4 Members (Family / Household sharing)',
      txLimit: 'Unlimited',
      features: [
        'Unlimited monthly transactions',
        '4 Members (Full Team / Family sharing)',
        'Multiple Banks & Cash Wallet tracking',
        'Statement PDF & CSV auto-import',
        'CSV / Excel export',
        'Category budgets & alerts',
        'Loans, Debts & EMI Tracker',
        'Advanced Charts & Spending Trends',
        'Priority Cloud Sync',
      ],
      description: `Pro Plan (90-Day Free Trial, ${daysText}) — 4 members max, unlimited transactions, loans/EMI tracker, advanced analytics.`,
    };
  }

  if (sub === 'monthly' || sub === 'yearly' || sub === 'lifetime' || sub === 'pro') {
    const pricing = sub === 'yearly' ? '₹999 / year' : sub === 'lifetime' ? 'Lifetime Access' : '₹100 / month';
    return {
      tier: sub,
      name: 'Pro Plan',
      price: pricing,
      status: 'Active (Subscribed)',
      isPro: true,
      memberLimit: 4,
      memberLimitDesc: '4 Members (Family / Household sharing)',
      txLimit: 'Unlimited',
      features: [
        'Unlimited monthly transactions',
        '4 Members (Full Team / Family sharing)',
        'Multiple Banks & Cash Wallet tracking',
        'Statement PDF & CSV auto-import',
        'CSV / Excel export',
        'Category budgets & alerts',
        'Loans, Debts & EMI Tracker',
        'Advanced Charts & Spending Trends',
        'Priority Cloud Sync',
      ],
      description: `Pro Plan (${pricing}) — 4 members max, unlimited transactions, loans/EMI tracker, advanced analytics.`,
    };
  }

  // Default: Free Plan
  return {
    tier: 'free',
    name: 'Free Plan',
    price: '₹0 / month',
    status: 'Active (Free Tier)',
    isPro: false,
    memberLimit: 1,
    memberLimitDesc: '1 Member Max (Owner only, no team/family sharing)',
    txLimit: '50 transactions / month',
    features: [
      'Up to 50 transactions per month',
      '1 Member Max (Owner only)',
      'Manual transaction entry',
      'Basic category tracking & budgeting',
    ],
    description: 'Free Plan (₹0/mo) — 1 member max, 50 transactions per month, basic manual tracking.',
  };
}

// ─── USER & TEAM RESOLVER ───────────────────────────────────────────────────
async function resolveUserProfileAndTeam(db, uid, data = {}) {
  let profileName = null;
  let userEmail = data.email || null;

  // 1. Try Firebase Auth UserRecord via Admin Auth
  try {
    const { getApps } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    const app = getApps().find(a => a.name === 'mcp-budget-tracker') || getApps()[0];
    if (app) {
      const userRecord = await getAuth(app).getUser(uid).catch(() => null);
      if (userRecord) {
        if (userRecord.displayName) profileName = userRecord.displayName;
        if (userRecord.email) userEmail = userEmail || userRecord.email;
      }
    }
  } catch (e) {
    console.warn('[MCP] getAuth lookup warning:', e.message);
  }

  // 2. Fallbacks from Firestore document
  if (!profileName || profileName.toLowerCase() === 'user') {
    profileName = data.profile?.displayName
      || data.profile?.name
      || (data.profile?.firstName ? `${data.profile.firstName} ${data.profile.lastName || ''}`.trim() : null)
      || data.displayName
      || data.name;
  }

  // 3. Fallback from latest OAuth login if available
  if (!profileName || profileName.toLowerCase() === 'user') {
    try {
      const codeQuery = await db.collection('oauth_codes').where('uid', '==', uid).limit(1).get().catch(() => null);
      if (codeQuery && !codeQuery.empty) {
        const cData = codeQuery.docs[0].data();
        if (cData.name) profileName = cData.name;
        if (cData.email) userEmail = userEmail || cData.email;
      }
    } catch {
      // Non-fatal fallback error ignored
    }
  }

  // 4. Fallback to email username or Suresh
  if (!profileName || profileName.toLowerCase() === 'user') {
    profileName = (userEmail ? userEmail.split('@')[0] : null) || 'Suresh';
  }

  // 3. Resolve Household / Team
  let teamName = 'Personal Account';
  let teamRole = 'Owner';
  let teamMembers = [];
  let householdId = data.householdId || null;

  try {
    let householdDoc = null;
    if (householdId) {
      householdDoc = await db.collection('households').doc(householdId).get().catch(() => null);
    } else {
      const hQuery = await db.collection('households').where('memberIds', 'array-contains', uid).limit(1).get().catch(() => null);
      if (hQuery && !hQuery.empty) {
        householdDoc = hQuery.docs[0];
        householdId = householdDoc.id;
      }
    }

    if (householdDoc && householdDoc.exists) {
      const hData = householdDoc.data();
      teamName = hData.name || 'My Household';
      teamRole = hData.ownerId === uid ? 'Team Owner' : 'Team Member';
      const membersMap = hData.members || {};
      teamMembers = Object.entries(membersMap).map(([mUid, m]) => ({
        name: m.name || m.displayName || m.email?.split('@')[0] || (mUid === uid ? profileName : 'Member'),
        email: m.email || '',
        role: m.role || (mUid === hData.ownerId ? 'Owner' : 'Member'),
        isCurrent: mUid === uid,
      }));
      if (teamMembers.length === 0 && Array.isArray(hData.memberIds)) {
        teamMembers = hData.memberIds.map(mId => ({
          name: mId === uid ? profileName : `Member (${mId.slice(0, 5)})`,
          role: mId === hData.ownerId ? 'Owner' : 'Member',
          isCurrent: mId === uid,
        }));
      }
    }
  } catch (err) {
    console.warn('[MCP] Household lookup warning:', err.message);
  }

  const plan = getPlanDetails(data.subscription, data.trialEndDate);

  return {
    uid,
    profileName,
    email: userEmail,
    subscription: data.subscription || 'trial',
    trialEndDate: data.trialEndDate || null,
    plan,
    householdId,
    teamName,
    teamRole,
    teamMembers,
  };
}

// ─── TOOL: get_profile ────────────────────────────────────────────────────────
async function handleGetProfile(targetUid) {
  const db = await getMcpDb();
  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const userData = await getUserData(uid);
  const info = await resolveUserProfileAndTeam(db, uid, userData);
  const p = info.plan;

  const lines = [
    `👤 USER PROFILE & ACCOUNT INFORMATION`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `• Profile Name:   ${info.profileName}`,
    `• Email:          ${info.email || '(Not specified)'}`,
    `• User ID (UID):  ${info.uid}`,
    ``,
    `⭐ SUBSCRIPTION PLAN & TIER:`,
    `• Plan Name:      ${p.name}`,
    `• Tier Key:       ${p.tier.toUpperCase()}`,
    `• Status:         ${p.status}`,
    `• Price:          ${p.price}`,
    `• Member Limit:   ${p.memberLimitDesc}`,
    `• Txn Limit:      ${p.txLimit}`,
    `• Included Features:`,
    ...p.features.map(f => `   ✓ ${f}`),
    ``,
    `👥 TEAM & HOUSEHOLD:`,
    `• Team Name:      ${info.teamName}`,
    `• Team Role:      ${info.teamRole}`,
    `• Current Members:${info.teamMembers.length > 0 ? ` ${info.teamMembers.length} / ${p.memberLimit} allowed` : ` 1 / ${p.memberLimit} allowed`}`,
    ...(info.teamMembers.length > 0
      ? info.teamMembers.map(m => `   - ${m.name} (${m.role})${m.isCurrent ? ' ← You' : ''}`)
      : [`   - ${info.profileName} (Owner) ← You`]),
  ];

  return lines.join('\n');
}

// ─── TOOL: get_balances ───────────────────────────────────────────────────────
async function handleGetBalances(targetUid) {
  const db = await getMcpDb();
  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const info = await resolveUserProfileAndTeam(db, uid, data);
  const { transactions = [], initialBankBalances = {}, initialCashBalance = 0,
          cashSeedDate, accountingStartDate, monthlyBudget = 0, subscription = 'free' } = data;

  // Compute bank balances (discovering from transactions + initial balances)
  const bankMap = {};

  // 1. Populate from initialBankBalances
  Object.entries(initialBankBalances || {}).forEach(([key, seed]) => {
    const [bankName, accountEnding] = key.split('_');
    bankMap[key] = {
      bankName, accountEnding,
      balance: parseFloat(seed.amount) || 0,
      seedDate: seed.date ? new Date(seed.date) : null,
      hasSeed: true,
    };
  });

  // 2. Discover banks from transactions if not present
  transactions.forEach(t => {
    if (!t.bankName || !t.accountEnding) return;
    if (t.bankName === 'GPay/UPI' || t.bankName === 'PhonePe') return;
    const key = `${t.bankName}_${t.accountEnding}`;
    if (!bankMap[key]) {
      bankMap[key] = {
        bankName: t.bankName,
        accountEnding: t.accountEnding,
        balance: 0,
        seedDate: null,
        hasSeed: false,
      };
    }
  });

  // 3. For each bank, check for availableBalance anchors or calculate ledger
  const effectiveStart = accountingStartDate ? new Date(accountingStartDate) : null;

  Object.keys(bankMap).forEach(key => {
    const entry = bankMap[key];
    const accountTxs = transactions
      .filter(t => `${t.bankName}_${t.accountEnding}` === key)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Check if there is an SMS availableBalance anchor
    const withBalance = accountTxs.filter(t => t.availableBalance != null);
    if (withBalance.length > 0 && !entry.hasSeed) {
      const anchor = withBalance[0];
      const anchorDate = new Date(anchor.date);
      let bal = Number(anchor.availableBalance) || 0;
      // Apply any strictly newer transactions after this anchor
      accountTxs
        .filter(t => new Date(t.date) > anchorDate)
        .forEach(t => {
          if (t.type === 'income') bal += (t.amount || 0);
          else if (t.type === 'expense' || t.type === 'debt') bal -= (t.amount || 0);
        });
      entry.balance = bal;
    } else {
      // Replay transactions over seed or base 0
      let bal = entry.balance;
      accountTxs.reverse().forEach(t => {
        const tDate = new Date(t.date);
        if (effectiveStart && tDate < effectiveStart) return;
        if (entry.seedDate && tDate <= entry.seedDate) return;
        if (t.type === 'income') bal += (t.amount || 0);
        else if (t.type === 'expense' || t.type === 'debt') bal -= (t.amount || 0);
      });
      entry.balance = bal;
    }
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
    `👤 Profile: ${info.profileName}  |  Team: ${info.teamName} (${info.teamRole})`,
    `⭐ Plan: ${info.plan.name} (${info.plan.status})  |  Email: ${info.email || 'N/A'}`,
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
async function handleGetTransactions(args = {}, targetUid) {
  const data = await getUserData(targetUid);
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
async function handleGetMonthlySummary(args = {}, targetUid) {
  const data = await getUserData(targetUid);
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
async function handleAddTransaction(args = {}, targetUid) {
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

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
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
    paidBy: (data.profile?.firstName || data.displayName || (uid === DEFAULT_ROSIE_UID ? 'Rosy' : 'Suresh')),
    createdBy: 'Claude',
    updatedBy: 'Claude',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  await db.collection('users').doc(uid).set({
    transactions: [...transactions, newTx],
  }, { merge: true });

  if (data.householdId) {
    const hDoc = await db.collection('households').doc(data.householdId).get().catch(() => null);
    const existingHTxs = (hDoc && hDoc.exists && hDoc.data()?.transactions) || transactions || [];
    await db.collection('households').doc(data.householdId).set({
      transactions: [...existingHTxs, newTx],
    }, { merge: true }).catch(e => console.warn('[MCP] Household save warning:', e.message));
  }

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
async function handleListCategories(args = {}, targetUid) {
  const data = await getUserData(targetUid);
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

// ─── TOOL: add_category ───────────────────────────────────────────────────────
async function handleAddCategory(args = {}, targetUid) {
  const { name, type = 'expense', budget = 0, color, icon } = args;
  if (!name || !name.trim()) {
    throw new Error('Category name is required.');
  }

  const validTypes = ['income', 'expense', 'savings', 'debt'];
  const catType = validTypes.includes(type) ? type : 'expense';

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const { categories = [] } = data;

  // Check duplicate name
  const existing = categories.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    throw new Error(`Category "${name.trim()}" already exists (ID: ${existing.id}).`);
  }

  const defaultColors = {
    income: '#10b981',
    expense: '#f59e0b',
    savings: '#06b6d4',
    debt: '#f97316',
  };

  const defaultIcons = {
    income: 'Wallet',
    expense: 'Tag',
    savings: 'PiggyBank',
    debt: 'CreditCard',
  };

  const newId = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const newCat = {
    id: newId,
    name: name.trim(),
    type: catType,
    budget: Math.max(0, Number(budget) || 0),
    color: color || defaultColors[catType] || '#6366f1',
    icon: icon || defaultIcons[catType] || 'Tag',
  };

  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  await db.collection('users').doc(uid).set({
    categories: [...categories, newCat],
  }, { merge: true });

  return [
    `✅ CATEGORY CREATED SUCCESSFULLY`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Name:    ${newCat.name}`,
    `Type:    ${newCat.type.toUpperCase()}`,
    `Budget:  ${fmt(newCat.budget)} / month`,
    `ID:      ${newCat.id}`,
    ``,
    `The new category is now saved and available for transactions in Budget Tracker!`,
  ].join('\n');
}

// ─── TOOL: edit_category ──────────────────────────────────────────────────────
async function handleEditCategory(args = {}, targetUid) {
  const { category, new_name, budget, color, icon } = args;
  if (!category) {
    throw new Error('category (name or ID) is required.');
  }

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const { categories = [] } = data;

  const targetIdx = categories.findIndex(c =>
    String(c.id) === String(category) ||
    c.name.toLowerCase() === String(category).toLowerCase() ||
    c.name.toLowerCase().includes(String(category).toLowerCase())
  );

  if (targetIdx === -1) {
    throw new Error(`Category "${category}" not found.`);
  }

  const current = categories[targetIdx];
  const updated = {
    ...current,
    ...(new_name && new_name.trim() ? { name: new_name.trim() } : {}),
    ...(budget !== undefined ? { budget: Math.max(0, Number(budget) || 0) } : {}),
    ...(color ? { color } : {}),
    ...(icon ? { icon } : {}),
  };

  const newCategories = [...categories];
  newCategories[targetIdx] = updated;

  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  await db.collection('users').doc(uid).set({
    categories: newCategories,
  }, { merge: true });

  return [
    `✅ CATEGORY UPDATED SUCCESSFULLY`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Category: ${current.name} (ID: ${current.id})`,
    new_name ? `New Name: ${updated.name}` : null,
    budget !== undefined ? `New Budget: ${fmt(updated.budget)} / month (was: ${fmt(current.budget)})` : null,
    color ? `New Color: ${updated.color}` : null,
    icon ? `New Icon: ${updated.icon}` : null,
    ``,
    `Changes are saved to your Budget Tracker.`,
  ].filter(Boolean).join('\n');
}

// ─── TOOL: delete_category ────────────────────────────────────────────────────
async function handleDeleteCategory(args = {}, targetUid) {
  const { category } = args;
  if (!category) {
    throw new Error('category (name or ID) is required.');
  }

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const { categories = [], transactions = [] } = data;

  const target = categories.find(c =>
    String(c.id) === String(category) ||
    c.name.toLowerCase() === String(category).toLowerCase() ||
    c.name.toLowerCase().includes(String(category).toLowerCase())
  );

  if (!target) {
    throw new Error(`Category "${category}" not found.`);
  }

  // Count existing transactions using this category
  const txCount = transactions.filter(t => String(t.categoryId) === String(target.id)).length;

  const remainingCategories = categories.filter(c => String(c.id) !== String(target.id));

  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  await db.collection('users').doc(uid).set({
    categories: remainingCategories,
  }, { merge: true });

  return [
    `🗑️ CATEGORY DELETED SUCCESSFULLY`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Deleted: ${target.name} (${target.type})`,
    `ID:      ${target.id}`,
    txCount > 0 ? `⚠️ Note: ${txCount} existing transactions used this category. They will now appear as Uncategorised.` : `No existing transactions were linked to this category.`,
    ``,
    `Category successfully removed from your Budget Tracker.`,
  ].join('\n');
}

// ─── TOOL: get_loans_and_recurring ───────────────────────────────────────────
async function handleGetLoansAndRecurring(targetUid) {
  const data = await getUserData(targetUid);
  const { loans = [], recurring = [], categories = [] } = data;

  const catMap = {};
  categories.forEach(c => { catMap[String(c.id)] = c; });

  const lines = [`💳 LOANS, RECURRING BILLS & LENT MONEY`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`];

  // Lent to friends (To Collect / Receivables)
  const lentList = (loans || []).filter(l => 
    l.type === 'lent' || 
    l.direction === 'to_receive' || 
    (l.name && l.name.toLowerCase().includes('owes'))
  );
  const pendingLent = lentList.filter(l => l.status !== 'settled');
  if (pendingLent.length > 0) {
    lines.push(``, `🤝 LENT TO FRIENDS (TO COLLECT - ${pendingLent.length}):`);
    pendingLent.forEach(l => {
      lines.push(`   • ${l.name || 'Friend'}: ${fmt(l.principal || l.amount || 0)} ${l.dueDate ? `(Due: ${l.dueDate})` : ''} ${l.note ? `[${l.note}]` : ''}`);
    });
    const totalToCollect = pendingLent.reduce((s, l) => s + (Number(l.principal || l.amount) || 0), 0);
    lines.push(`   📊 Total Receivable: ${fmt(totalToCollect)}`);
  } else {
    lines.push(``, `🤝 LENT TO FRIENDS: No pending amounts to collect.`);
  }

  // Active Loans & EMIs (Borrowed by user)
  const actualLoans = (loans || []).filter(l => 
    l.type !== 'lent' && 
    l.direction !== 'to_receive' && 
    (!l.name || !l.name.toLowerCase().includes('owes'))
  );
  if (actualLoans.length > 0) {
    lines.push(``, `🏦 ACTIVE LOANS & EMIs (${actualLoans.length}):`);
    actualLoans.forEach(l => {
      const loanLines = [
        ``,
        `   📌 ${l.name || l.type || 'Loan'}`,
        `   • Principal:        ${fmt(l.principal || l.totalAmount || l.principalAmount)}`,
        `   • Remaining:        ${fmt(l.remainingAmount || l.principal)}`,
        `   • Monthly EMI:      ${fmt(l.monthlyAmount || l.emi || l.monthlyPayment)}`,
        l.interestRate ? `   • Interest Rate:    ${l.interestRate}% p.a.` : '',
        l.dueDate ? `   • Due Date:         ${new Date(l.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''
      ].filter(Boolean);
      lines.push(...loanLines);
    });
    const totalEmi = actualLoans.reduce((s, l) => s + (Number(l.monthlyAmount || l.emi || l.monthlyPayment) || 0), 0);
    lines.push(``, `   📊 Total Monthly EMI: ${fmt(totalEmi)}`);
  } else {
    lines.push(``, `🏦 ACTIVE LOANS: No active loans recorded.`);
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

// ─── TOOL: set_bank_balance ──────────────────────────────────────────────────
async function handleSetBankBalance(args = {}, targetUid) {
  const { bank_name, amount, account_ending = 'primary' } = args;
  if (!bank_name || amount === undefined || amount === null) {
    throw new Error('bank_name and amount are required.');
  }

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  const key = `${bank_name.trim()}_${account_ending.trim()}`;
  const bankBalances = {
    ...(data.initialBankBalances || {}),
    [key]: {
      amount: Number(amount),
      bankName: bank_name.trim(),
      accountEnding: account_ending.trim(),
      date: new Date().toISOString(),
    }
  };

  await db.collection('users').doc(uid).set({
    initialBankBalances: bankBalances
  }, { merge: true });

  if (data.householdId) {
    const hhRef = db.collection('households').doc(data.householdId);
    const snap = await hhRef.get().catch(() => null);
    if (snap && snap.exists) {
      const members = snap.data().members || {};
      if (members[uid]) {
        members[uid].initialBankBalances = bankBalances;
        await hhRef.update({ members }).catch(() => {});
      }
    }
  }

  return [
    `🏦 BANK BALANCE UPDATED`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Bank:         ${bank_name} (${account_ending})`,
    `New Balance:  ${fmt(Number(amount))}`,
    `Updated on:   ${new Date().toLocaleDateString('en-IN')}`,
    ``,
    `Your dashboard has been updated in real-time.`,
  ].join('\n');
}

// ─── TOOL: set_cash_balance ──────────────────────────────────────────────────
async function handleSetCashBalance(args = {}, targetUid) {
  const { amount } = args;
  if (amount === undefined || amount === null) {
    throw new Error('amount is required.');
  }

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  const now = new Date().toISOString();
  await db.collection('users').doc(uid).set({
    initialCashBalance: Number(amount),
    cashSeedDate: now,
  }, { merge: true });

  if (data.householdId) {
    const hhRef = db.collection('households').doc(data.householdId);
    const snap = await hhRef.get().catch(() => null);
    if (snap && snap.exists) {
      const members = snap.data().members || {};
      if (members[uid]) {
        members[uid].initialCashBalance = Number(amount);
        members[uid].cashSeedDate = now;
        await hhRef.update({ members }).catch(() => {});
      }
    }
  }

  return [
    `💵 CASH ON HAND UPDATED`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Cash on Hand: ${fmt(Number(amount))}`,
    `Updated on:   ${new Date().toLocaleDateString('en-IN')}`,
    ``,
    `Your dashboard Cash on Hand card has been updated.`,
  ].join('\n');
}

// ─── TOOL: set_monthly_budget ────────────────────────────────────────────────
async function handleSetMonthlyBudget(args = {}, targetUid) {
  const { amount } = args;
  if (amount === undefined || amount === null) {
    throw new Error('amount is required.');
  }

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  await db.collection('users').doc(uid).set({
    monthlyBudget: Number(amount),
  }, { merge: true });

  if (data.householdId) {
    await db.collection('households').doc(data.householdId).set({
      monthlyBudget: Number(amount),
    }, { merge: true }).catch(() => {});
  }

  return [
    `🎯 MONTHLY BUDGET UPDATED`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Monthly Budget: ${fmt(Number(amount))}`,
    `Updated on:     ${new Date().toLocaleDateString('en-IN')}`,
    ``,
    `Your spending pace and budget health bars have been refreshed.`,
  ].join('\n');
}

// ─── TOOL: add_lent ──────────────────────────────────────────────────────────
async function handleAddLent(args = {}, targetUid) {
  const { name, amount, note, due_date } = args;
  if (!name || !amount) {
    throw new Error('name and amount are required.');
  }

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  const loans = data.loans || [];
  const newItem = {
    id: `lent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'lent',
    direction: 'to_receive',
    name: name.trim(),
    principal: Number(amount),
    monthlyAmount: 0,
    interestRate: 0,
    tenure: 0,
    startDate: new Date().toISOString(),
    dueDate: due_date || null,
    note: note ? note.trim() : '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const updatedLoans = [...loans, newItem];

  await db.collection('users').doc(uid).set({
    loans: updatedLoans,
  }, { merge: true });

  if (data.householdId) {
    await db.collection('households').doc(data.householdId).set({
      loans: updatedLoans,
    }, { merge: true }).catch(() => {});
  }

  return [
    `🤝 LENT TO FRIEND RECORDED (RECEIVABLE)`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Friend Name:  ${name}`,
    `Amount Lent:  ${fmt(Number(amount))}`,
    `Note:         ${note || 'None'}`,
    `Status:       Pending (To Collect)`,
    `Date:         ${new Date().toLocaleDateString('en-IN')}`,
    ``,
    `Added to your "Lent to Friends" card on Dashboard. You can send WhatsApp reminders or mark received anytime.`,
  ].join('\n');
}

// ─── TOOL: settle_lent ───────────────────────────────────────────────────────
async function handleSettleLent(args = {}, targetUid) {
  const { name, amount } = args;
  if (!name) throw new Error('name is required.');

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  const loans = data.loans || [];
  const query = name.toLowerCase().trim();

  // Find matching pending lent entry
  const lentIndex = loans.findIndex(l =>
    (l.type === 'lent' || l.direction === 'to_receive' || (l.name && l.name.toLowerCase().includes('owes'))) &&
    l.status !== 'settled' &&
    (l.name.toLowerCase().includes(query) || l.id === name)
  );

  if (lentIndex === -1) {
    throw new Error(`No pending lent entry found matching "${name}". Check get_loans_and_recurring to see active receivables.`);
  }

  const targetLent = loans[lentIndex];
  const returnAmt = amount ? Number(amount) : targetLent.principal;

  // 1. Mark loan as settled
  const updatedLoans = [...loans];
  updatedLoans[lentIndex] = {
    ...targetLent,
    status: 'settled',
    settledAt: new Date().toISOString(),
  };

  // 2. Add income transaction
  const newTx = {
    id: `mcp_${Date.now()}_settle`,
    type: 'income',
    amount: returnAmt,
    description: `Returned by ${targetLent.name}`,
    categoryId: '1',
    paymentMode: 'cash',
    source: 'mcp',
    paidBy: (data.profile?.firstName || data.displayName || 'Suresh'),
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const updatedTxs = [...(data.transactions || []), newTx];

  await db.collection('users').doc(uid).set({
    loans: updatedLoans,
    transactions: updatedTxs,
  }, { merge: true });

  if (data.householdId) {
    await db.collection('households').doc(data.householdId).set({
      loans: updatedLoans,
      transactions: updatedTxs,
    }, { merge: true }).catch(() => {});
  }

  return [
    `🎉 LENT MONEY RECEIVED & SETTLED`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Friend Name:     ${targetLent.name}`,
    `Amount Received: ${fmt(returnAmt)}`,
    `Status:          Settled ✅`,
    `Income Entry:    Added "${newTx.description}" to Transactions`,
    ``,
    `The pending receivable has been cleared and added to your balance.`,
  ].join('\n');
}

// ─── TOOL: delete_transaction ────────────────────────────────────────────────
async function handleDeleteTransaction(args = {}, targetUid) {
  const { id, latest, search, amount } = args;

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  const txs = [...(data.transactions || [])];
  if (txs.length === 0) throw new Error('No transactions found to delete.');

  let targetIndex = -1;

  if (latest) {
    targetIndex = txs.length - 1;
  } else if (id) {
    targetIndex = txs.findIndex(t => t.id === id);
  } else if (search || amount) {
    targetIndex = txs.findLastIndex(t => {
      const matchSearch = search ? t.description.toLowerCase().includes(search.toLowerCase()) : true;
      const matchAmt = amount ? Math.abs(t.amount - Number(amount)) < 0.01 : true;
      return matchSearch && matchAmt;
    });
  }

  if (targetIndex === -1) {
    throw new Error('Transaction not found matching criteria.');
  }

  const [removed] = txs.splice(targetIndex, 1);

  await db.collection('users').doc(uid).set({
    transactions: txs,
  }, { merge: true });

  if (data.householdId) {
    await db.collection('households').doc(data.householdId).set({
      transactions: txs,
    }, { merge: true }).catch(() => {});
  }

  return [
    `🗑️ TRANSACTION DELETED`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Description: ${removed.description}`,
    `Amount:      ${fmt(removed.amount)}`,
    `Type:        ${removed.type}`,
    `Date:        ${new Date(removed.date).toLocaleDateString('en-IN')}`,
    ``,
    `Removed successfully from your ledger.`,
  ].join('\n');
}

// ─── TOOL: add_recurring ─────────────────────────────────────────────────────
async function handleAddRecurring(args = {}, targetUid) {
  const { name, amount, frequency = 'monthly', category_name } = args;
  if (!name || !amount) throw new Error('name and amount are required.');

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  const categories = data.categories || [];
  let categoryId = null;
  if (category_name) {
    const match = categories.find(c => c.name.toLowerCase().includes(category_name.toLowerCase()));
    if (match) categoryId = String(match.id);
  }

  const newItem = {
    id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    amount: Number(amount),
    frequency,
    categoryId,
    active: true,
    startDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const updated = [...(data.recurring || []), newItem];

  await db.collection('users').doc(uid).set({ recurring: updated }, { merge: true });
  if (data.householdId) {
    await db.collection('households').doc(data.householdId).set({ recurring: updated }, { merge: true }).catch(() => {});
  }

  return [
    `📅 RECURRING BILL ADDED`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Name:      ${name}`,
    `Amount:    ${fmt(Number(amount))}`,
    `Frequency: ${frequency}`,
    ``,
    `Added to Upcoming Payments & smart bill reminders.`,
  ].join('\n');
}

// ─── TOOL: delete_recurring ──────────────────────────────────────────────────
async function handleDeleteRecurring(args = {}, targetUid) {
  const { name } = args;
  if (!name) throw new Error('name or ID is required.');

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  const query = name.toLowerCase().trim();
  const list = data.recurring || [];
  const filtered = list.filter(r => r.id !== name && !r.name.toLowerCase().includes(query));

  if (filtered.length === list.length) {
    throw new Error(`Recurring bill "${name}" not found.`);
  }

  await db.collection('users').doc(uid).set({ recurring: filtered }, { merge: true });
  if (data.householdId) {
    await db.collection('households').doc(data.householdId).set({ recurring: filtered }, { merge: true }).catch(() => {});
  }

  return `🗑️ Recurring bill "${name}" deleted successfully.`;
}

// ─── TOOL: add_loan ──────────────────────────────────────────────────────────
async function handleAddLoan(args = {}, targetUid) {
  const { name, type = 'emi', principal, monthly_amount, tenure, interest_rate } = args;
  if (!name) throw new Error('name is required.');

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  const newItem = {
    id: `loan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    type: type || 'emi',
    direction: 'to_pay',
    principal: Number(principal) || 0,
    monthlyAmount: Number(monthly_amount) || 0,
    tenure: Number(tenure) || 0,
    interestRate: Number(interest_rate) || 0,
    startDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const updated = [...(data.loans || []), newItem];

  await db.collection('users').doc(uid).set({ loans: updated }, { merge: true });
  if (data.householdId) {
    await db.collection('households').doc(data.householdId).set({ loans: updated }, { merge: true }).catch(() => {});
  }

  return [
    `🏦 LOAN / EMI RECORDED`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Name:           ${name}`,
    `Type:           ${type.toUpperCase()}`,
    `Monthly EMI:    ${monthly_amount ? fmt(Number(monthly_amount)) : 'N/A'}`,
    `Principal:      ${principal ? fmt(Number(principal)) : 'N/A'}`,
    `Tenure:         ${tenure ? tenure + ' months' : 'N/A'}`,
    ``,
    `Added to your Loans section in Budget Tracker.`,
  ].join('\n');
}

// ─── TOOL: delete_loan ───────────────────────────────────────────────────────
async function handleDeleteLoan(args = {}, targetUid) {
  const { name } = args;
  if (!name) throw new Error('name or ID is required.');

  const uid = targetUid || process.env.MCP_USER_UID || DEFAULT_SURESH_UID;
  const data = await getUserData(uid);
  const db = await getMcpDb();
  if (!db) throw new Error('Firebase Admin not configured.');

  const query = name.toLowerCase().trim();
  const list = data.loans || [];
  const filtered = list.filter(l => l.id !== name && !l.name.toLowerCase().includes(query));

  if (filtered.length === list.length) {
    throw new Error(`Loan "${name}" not found.`);
  }

  await db.collection('users').doc(uid).set({ loans: filtered }, { merge: true });
  if (data.householdId) {
    await db.collection('households').doc(data.householdId).set({ loans: filtered }, { merge: true }).catch(() => {});
  }

  return `🗑️ Loan "${name}" deleted successfully.`;
}

// ─── JSON-RPC DISPATCHER ─────────────────────────────────────────────────────
async function handleJsonRpc(request, targetUid) {
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
          serverInfo: {
            name: 'Budget Tracker Pro',
            title: 'Budget Tracker Pro',
            version: '1.0.0',
            icon: 'https://personal-finance-app-mauve.vercel.app/app-icon-512.png',
            logo: 'https://personal-finance-app-mauve.vercel.app/app-icon-512.png',
            icon_url: 'https://personal-finance-app-mauve.vercel.app/app-icon-512.png',
            logo_uri: 'https://personal-finance-app-mauve.vercel.app/app-icon-512.png',
            icons: [
              {
                src: 'https://personal-finance-app-mauve.vercel.app/app-icon-512.png',
                mimeType: 'image/png',
                sizes: ['512x512']
              },
              {
                src: 'https://personal-finance-app-mauve.vercel.app/favicon.svg',
                mimeType: 'image/svg+xml'
              },
              {
                src: 'https://personal-finance-app-mauve.vercel.app/favicon.ico',
                mimeType: 'image/x-icon',
                sizes: ['32x32']
              }
            ],
          },
        });

      case 'notifications/initialized':
        return null;

      case 'ping':
        return ok({});

      case 'tools/list':
        return ok({ tools: TOOLS });

      case 'tools/call': {
        const { name, arguments: args } = params || {};

        // Rate limit check: 20 req/min for write tools, 60 req/min for read tools
        const rateLimit = checkMcpRateLimit(targetUid, name);
        if (!rateLimit.allowed) {
          return err(
            -32029,
            `Rate limit exceeded for tool "${name}". Maximum allowed is ${rateLimit.maxLimit} requests/min. Please retry in ${rateLimit.retryAfterSeconds} seconds.`
          );
        }

        let text;

        switch (name) {
          case 'get_profile':           text = await handleGetProfile(targetUid); break;
          case 'get_balances':          text = await handleGetBalances(targetUid); break;
          case 'get_transactions':      text = await handleGetTransactions(args, targetUid); break;
          case 'get_monthly_summary':   text = await handleGetMonthlySummary(args, targetUid); break;
          case 'add_transaction':       text = await handleAddTransaction(args, targetUid); break;
          case 'list_categories':       text = await handleListCategories(args, targetUid); break;
          case 'add_category':          text = await handleAddCategory(args, targetUid); break;
          case 'edit_category':         text = await handleEditCategory(args, targetUid); break;
          case 'delete_category':       text = await handleDeleteCategory(args, targetUid); break;
          case 'get_loans_and_recurring': text = await handleGetLoansAndRecurring(targetUid); break;
          case 'set_bank_balance':      text = await handleSetBankBalance(args, targetUid); break;
          case 'set_cash_balance':      text = await handleSetCashBalance(args, targetUid); break;
          case 'set_monthly_budget':    text = await handleSetMonthlyBudget(args, targetUid); break;
          case 'add_lent':              text = await handleAddLent(args, targetUid); break;
          case 'settle_lent':           text = await handleSettleLent(args, targetUid); break;
          case 'delete_transaction':    text = await handleDeleteTransaction(args, targetUid); break;
          case 'add_recurring':         text = await handleAddRecurring(args, targetUid); break;
          case 'delete_recurring':      text = await handleDeleteRecurring(args, targetUid); break;
          case 'add_loan':              text = await handleAddLoan(args, targetUid); break;
          case 'delete_loan':           text = await handleDeleteLoan(args, targetUid); break;
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

  // ── GET — public server metadata & health check (discovered by Claude / MCP clients) ───
  if (req.method === 'GET') {
    return res.status(200).json({
      name: 'Budget Tracker Pro',
      title: 'Budget Tracker Pro',
      version: '1.0.0',
      description: 'Personal finance & smart budget tracking with Claude AI',
      icon: 'https://personal-finance-app-mauve.vercel.app/app-icon-512.png',
      logo: 'https://personal-finance-app-mauve.vercel.app/app-icon-512.png',
      icon_url: 'https://personal-finance-app-mauve.vercel.app/app-icon-512.png',
      logo_uri: 'https://personal-finance-app-mauve.vercel.app/app-icon-512.png',
      icons: [
        {
          src: 'https://personal-finance-app-mauve.vercel.app/app-icon-512.png',
          mimeType: 'image/png',
          sizes: ['512x512']
        },
        {
          src: 'https://personal-finance-app-mauve.vercel.app/favicon.svg',
          mimeType: 'image/svg+xml'
        },
        {
          src: 'https://personal-finance-app-mauve.vercel.app/favicon.ico',
          mimeType: 'image/x-icon',
          sizes: ['32x32']
        }
      ],
      tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
      status: 'ok',
    });
  }

  // ── Rate Limiting (IP Throttling for DDoS & brute force prevention) ────────
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const ipCheck = globalRateLimiter.check(`ip:${clientIp}`, 120, 60000); // 120 req/min
  if (!ipCheck.allowed) {
    res.setHeader('Retry-After', String(ipCheck.retryAfterSeconds));
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Please retry in ${ipCheck.retryAfterSeconds} seconds.`,
    });
  }

  // ── Authentication for POST (OAuth Bearer Token OR Pre-shared API Key) ───────────
  let targetUid = null;
  const rawAuth = req.headers['authorization'] || '';
  const bearerMatch = rawAuth.match(/^Bearer\s+(.+)$/i);
  const candidateToken = bearerMatch ? bearerMatch[1].trim() : '';

  // 1. Try OAuth Bearer Token
  if (candidateToken) {
    const oauthPayload = verifyAccessToken(candidateToken);
    if (oauthPayload && oauthPayload.uid) {
      targetUid = oauthPayload.uid;
    }
  }

  // 2. Fallback to API Key / Query Key
  if (!targetUid) {
    const xApiKey = (req.headers['x-api-key'] || '').trim();
    const queryKey = (req.query?.key || '').trim();
    const providedKey = candidateToken === MCP_API_KEY ? MCP_API_KEY : (xApiKey || queryKey);

    if (MCP_API_KEY && providedKey === MCP_API_KEY) {
      targetUid = resolveTargetUid(req);
    }
  }

  // 3. Reject if neither is valid
  if (!targetUid) {
    res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token", realm="budget-tracker"');
    return res.status(401).json({ error: 'Unauthorized: Valid OAuth Bearer token or API key required.' });
  }

  // ── POST — JSON-RPC 2.0 ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;
    if (!body) return res.status(400).json({ error: 'Request body is empty.' });

    // Handle both single requests and batches
    const requests = Array.isArray(body) ? body : [body];
    const responses = [];

    for (const request of requests) {
      const response = await handleJsonRpc(request, targetUid);
      if (response !== null) responses.push(response);
    }

    if (responses.length === 0) return res.status(204).end();
    if (!Array.isArray(body) && responses.length === 1) return res.status(200).json(responses[0]);
    return res.status(200).json(responses);
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
