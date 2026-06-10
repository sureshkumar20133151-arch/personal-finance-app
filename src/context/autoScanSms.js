// autoScanSms.js — Fixed (June 2026)
// ═══════════════════════════════════════════════════════════════════════
// BUG FIXES:
//  1. Cr Bal false positive — "Cr Bal Rs.9500" was parsed as income ₹9500
//     Fix: Require currency symbol directly after Cr (no gap word allowed)
//  2. dr pattern without word boundary — "order #1234" matched as dr=1234
//     Fix: Added \b word boundaries to standalone dr/cr patterns
//  3. Missing debit keywords — "used for", "purchase", "debit of" not matched
//     Fix: Added to DEBIT_PATTERNS
//  4. Balance amounts picked up — "Avl Bal Rs.19800" captured as transaction
//     Fix: Pre-strip balance info from SMS before parsing (stripBalance)
//  5. Zero amount not filtered in smsParser.js — amount <= 0 now rejected
// ═══════════════════════════════════════════════════════════════════════

import { Capacitor } from '@capacitor/core';

const MessageReader = Capacitor.isNativePlatform()
  ? (() => { try { return window.Capacitor.Plugins.MessageReader; } catch { return null; } })()
  : null;

const NotificationListener = Capacitor.isNativePlatform()
  ? (() => { try { return window.Capacitor.Plugins.NotificationListener; } catch { return null; } })()
  : null;

// ─── Regex Patterns ─────────────────────────────────────────────────────────

const DEBIT_PATTERNS = [
  // "Rs.500 has been debited" / "INR 500 debited"
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has\s+been\s+)?(?:debited|spent|withdrawn|transferred|transfer|paid|deducted|sent|charged|charge)/i,
  // "debited Rs.500" / "paid Rs.500" / "used for Rs.500" / "purchase Rs.500" / "debit of Rs.500"
  /(?:debited|spent|paid|withdrawn|deducted|sent|transferred|transfer|charged|charge|used\s+for|purchased?|debit\s+(?:of|by|amount))\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  // "sent Rs.500 to"
  /sent\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*to/i,
  // FIX #2: Added \b word boundary — prevents matching "order", "address", etc.
  /\bdr\b\.?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  // "Rs.500 Dr"
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*\bdr\b/i,
  // "debited with Rs.500"
  /debited\s+with\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  // "txn of Rs.500"
  /txn\s+of\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  // "INR 500 debited"
  /(?:inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+debited/i,
  // "payment of Rs.500"
  /payment\s+of\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
];

const CREDIT_PATTERNS = [
  // "Rs.500 has been credited"
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has\s+been\s+)?(?:credited|deposited|received|added|refunded)/i,
  // "credited Rs.500"
  /(?:credited|deposited|received|added|refunded)\s*(?:for|by|of|with|towards)?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  // "paid you Rs.500"
  /(?:sent|transferred|paid)\s+you\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  // FIX #1: Was /cr\.?\s*(?:rs\.?|inr|₹)?\s*([\d,]+)/ — matched "Cr Bal Rs.9500"!
  // Now: currency symbol must directly follow Cr (no gap words like "Bal")
  /\bcr\b\.?\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  // "Rs.500 Cr" (amount then Cr)
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*\bcr\b/i,
];

const MERCHANT_PATTERN = /(?:at|to|towards|vpa|info|transfer\s+to|paid\s+to)\s+([a-zA-Z0-9\s\-_\.\\*@\/,\(\)]{3,}?)(?:\s+(?:on|via|using|ref|info|balance|date)|[.,]|\s*|$)/gi;
const MERCHANT_ALT_PATTERN = /(?:merchant|ref|txn)\s+(?:name\s+)?([a-zA-Z0-9\s\-_\.\\*@\/,\(\)]{3,25})/gi;
const MERCHANT_INDIAN_BANK = /\bto\s+([A-Z][A-Z\s\.]{2,20}?)\s*\.\s*UPI:/ig;

// ─── FIX #4: Strip balance info before parsing ────────────────────────────────
// Prevents "Avl Bal Rs.19800" or "Cr Bal Rs.9500" from being parsed as amount
function stripBalance(sms) {
  return sms
    // "Avl Bal Rs.9500" / "Available Balance Rs.9500" / "Avail Bal INR 9500"
    .replace(/(?:avl|avail(?:able)?\.?)\s*(?:bal(?:ance)?|limit)\s*(?:is\s*)?(?:inr|rs\.?|₹)?\s*:?\s*[\d,]+(?:\.\d{1,2})?/gi, '')
    // "Cr Bal Rs.9500" / "Cr Balance INR 9500"
    .replace(/\bcr\.?\s*bal(?:ance)?\s*(?:inr|rs\.?|₹)?\s*:?\s*[\d,]+(?:\.\d{1,2})?/gi, '')
    // "Balance Rs.9500" (standalone balance line)
    .replace(/\bbal(?:ance)?\s*(?:inr|rs\.?|₹)\s*:?\s*[\d,]+(?:\.\d{1,2})?/gi, '');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidMerchant(str) {
  if (!str) return false;
  const s = str.trim();
  if (s.length < 2) return false;
  const low = s.toLowerCase();
  if (low.includes('a/c') || low.includes('acct') || low.includes('account') ||
      low.includes('card') || low.includes('ending')) return false;
  const digits = s.replace(/\D/g, '');
  return !(digits.length > 0 && digits.length >= s.length * 0.7);
}

function getBankName(sms, sender = '') {
  const text = sms.toLowerCase();
  const snd = sender.toLowerCase();

  // 1. Sender ID (most reliable)
  if (snd.includes('indbnk') || snd.includes('indian') || snd.includes('idib')) return 'Indian Bank';
  if (snd.includes('canbka') || snd.includes('canara') || snd.includes('canbnk') || snd.includes('cnrb')) return 'Canara Bank';
  if (snd.includes('sbiinb') || snd.includes('sbi')) return 'SBI';
  if (snd.includes('hdfcbk') || snd.includes('hdfc')) return 'HDFC Bank';
  if (snd.includes('icicib') || snd.includes('icici')) return 'ICICI Bank';
  if (snd.includes('axisbk') || snd.includes('axis')) return 'Axis Bank';
  if (snd.includes('kotak')) return 'Kotak Bank';
  if (snd.includes('pnb')) return 'PNB';
  if (snd.includes('bob')) return 'Bank of Baroda';

  // 2. NEW — IFSC prefix in UPI string (identifies YOUR bank, not receiver)
  if (text.includes('/idib/') || text.includes('idib/**')) return 'Indian Bank';
  if (text.includes('/cnrb/') || text.includes('cnrb/**')) return 'Canara Bank';
  if (text.includes('/sbin/') || text.includes('sbin/**')) return 'SBI';
  if (text.includes('/utib/') || text.includes('utib/**')) return 'Axis Bank';
  if (text.includes('/hdfc/') || text.includes('hdfc/**')) return 'HDFC Bank';
  if (text.includes('/icic/') || text.includes('icic/**')) return 'ICICI Bank';
  if (text.includes('/punb/') || text.includes('punb/**')) return 'PNB';
  if (text.includes('/ubin/') || text.includes('ubin/**')) return 'Union Bank';

  // 3. SMS body — strip @ok handles and UPI strings first
  const cleanText = text
    .replace(/@ok[a-z]+/gi, '')      // remove @okicici @okaxis @oksbi etc
    .replace(/\/upi\/\/.+/gi, '');   // remove full UPI reference string

  if (cleanText.includes('indian bank') || cleanText.includes('ind bank') || cleanText.includes('indianbank')) return 'Indian Bank';
  if (cleanText.includes('canara') || cleanText.includes('cnrb')) return 'Canara Bank';
  if (cleanText.includes('kotak mahindra') || cleanText.includes('kotak')) return 'Kotak Bank';
  if (cleanText.includes('axis bank') || cleanText.includes('axis')) return 'Axis Bank';
  if (cleanText.includes('hdfc bank') || cleanText.includes('hdfc')) return 'HDFC Bank';
  if (cleanText.includes('icici bank') || cleanText.includes('icici')) return 'ICICI Bank';
  if (cleanText.includes('punjab national') || cleanText.includes('pnb')) return 'PNB';
  if (cleanText.includes('bank of baroda') || cleanText.includes('bob')) return 'Bank of Baroda';
  if (cleanText.includes('union bank')) return 'Union Bank';
  if (cleanText.includes('central bank')) return 'Central Bank';
  if (cleanText.includes('paytm') || cleanText.includes('ppbl')) return 'Paytm Bank';
  if (cleanText.includes('airtel') || cleanText.includes('apbl')) return 'Airtel Bank';
  if (cleanText.includes('state bank') || cleanText.includes('sbi') || cleanText.includes('yono')) return 'SBI';

  return 'Bank Account';
}

function getAccountEnding(body) {
  const patterns = [
    /a\/c\s*[*Xx•]+(\d{4})\b/i,
    /a\/c\s*[*Xx•]*(\d{3,4})\b/i,
    /acct?\s*(?:no\.?)?\s*[*Xx•]*(\d{4})\b/i,
    /account\s*(?:no\.?)?\s*[*Xx•]*(\d{4})\b/i,
    /ending\s+(?:in\s+)?(\d{4})\b/i,
    /x{2,}(\d{4})\b/i,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m?.[1]) return m[1].length >= 4 ? m[1].slice(-4) : m[1];
  }
  return null;
}

export function parseUpiNotification(body, dateMs) {
  if (!body) return null;
  const receivedPattern = /(.+?)\s+paid\s+you\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
  const sentPattern = /you\s+paid\s+(.+?)\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
  const phonepePattern = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+sent\s+to\s+(.+)/i;
  let amount = null, type = null, description = null;
  let m = body.match(receivedPattern);
  if (m) { amount = parseFloat(m[2].replace(/,/g, '')); type = 'income'; description = m[1].trim(); }
  if (!amount) {
    m = body.match(sentPattern);
    if (m) { amount = parseFloat(m[2].replace(/,/g, '')); type = 'expense'; description = m[1].trim(); }
  }
  if (!amount) {
    m = body.match(phonepePattern);
    if (m) { amount = parseFloat(m[1].replace(/,/g, '')); type = 'expense'; description = m[2].trim(); }
  }
  // FIX #5: reject zero/negative amounts
  if (!amount || isNaN(amount) || amount <= 0) return null;
  return {
    amount,
    description: description?.substring(0, 30) || 'UPI Transfer',
    type,
    date: dateMs ? new Date(dateMs).toISOString() : new Date().toISOString(),
    paymentMode: 'upi',
    bankName: 'GPay/UPI',
    accountEnding: null,
    availableBalance: null,
    source: 'sms',
    rawSms: body,
  };
}

export function getAvailableBalance(body) {
  const patterns = [
    /(?:total\s+)?avail(?:able)?\.?\s*bal(?:ance)?\s*(?:inr|rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /available\s+balance\s*:?\s*(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /\bbal\s+(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /balance\s*:?\s*(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m?.[1]) return parseFloat(m[1].replace(/,/g, ''));
  }
  return null;
}

export function parseSms(body, dateMs, sender = '') {
  if (!body) return null;
  const low = body.toLowerCase();

  // Skip failed/declined transactions
  if (low.includes('failed') || low.includes('declined') || low.includes('insufficient') ||
      low.includes('unsuccessful') || low.includes('rejected')) return null;

  // Must have a bank keyword to filter out OTP/promo SMS
  const bankKeywordRegex = /\b(a\/c|acct|account|balance|debited|credited|dr\b|cr\b|inr|rs\.?|₹|upi|neft|imps|rtgs|netbanking|atm)\b/i;
  if (!bankKeywordRegex.test(body)) return null;

  // FIX #4: Strip balance info BEFORE running amount patterns
  const stripped = stripBalance(body);

  let amount = null;
  let type = null;

  for (const p of DEBIT_PATTERNS) {
    const m = stripped.match(p);
    if (m) {
      const val = (m[1] || m[2] || '').replace(/,/g, '');
      if (val) { amount = parseFloat(val); type = 'expense'; break; }
    }
  }

  if (!amount) {
    for (const p of CREDIT_PATTERNS) {
      const m = stripped.match(p);
      if (m) {
        const val = (m[1] || m[2] || '').replace(/,/g, '');
        if (val) { amount = parseFloat(val); type = 'income'; break; }
      }
    }
  }

  // FIX #5: Reject zero and negative amounts
  if (!amount || isNaN(amount) || amount <= 0) return null;

  // Extract merchant
  let merchant = null;
  for (const m of body.matchAll(MERCHANT_INDIAN_BANK)) {
    if (m?.[1] && isValidMerchant(m[1])) { merchant = m[1].trim(); break; }
  }
  if (!merchant) {
    for (const m of body.matchAll(MERCHANT_PATTERN)) {
      if (m?.[1] && isValidMerchant(m[1])) { merchant = m[1].trim(); break; }
    }
  }
  if (!merchant) {
    for (const m of body.matchAll(MERCHANT_ALT_PATTERN)) {
      if (m?.[1] && isValidMerchant(m[1])) { merchant = m[1].trim(); break; }
    }
  }

  let description = 'Online Transaction';
  if (merchant) {
    merchant = merchant.split('(')[0].trim()
      .replace(/^vpa\s+/i, '')
      .replace(/[.,\s]+$/, '')
      .trim();
    description = merchant;
  }
  description = description.replace(/\s+/g, ' ');
  if (description.length > 30) description = description.substring(0, 27) + '...';

  // Payment mode
  let paymentMode = 'upi';
  if (low.includes('atm') || low.includes('cash withdrawal')) {
    paymentMode = 'cash'; description = 'ATM Cash Withdrawal';
  } else if (low.includes('card') || low.includes('debitcard') || low.includes('creditcard') || low.includes('ending in')) {
    paymentMode = 'card';
  } else if (low.includes('netbanking') || low.includes('internet banking') || low.includes('imps') || low.includes('neft') || low.includes('rtgs')) {
    paymentMode = 'netbanking';
  } else if (low.includes('upi') || low.includes('gpay') || low.includes('phonepe') || low.includes('paytm') || low.includes('amazonpay')) {
    paymentMode = 'upi';
  }

  const bName = getBankName(body, sender);
  let accEnd = getAccountEnding(body);
  
  // Normalization: Canara SMS genuinely only sends 3 digits (128). 
  // We explicitly map it to 9128 to match the PDF parser.
  if (bName === 'Canara Bank' && accEnd === '128') accEnd = '9128';

  return {
    amount,
    description,
    type,
    id: crypto.randomUUID(),
    date: dateMs ? new Date(dateMs).toISOString() : new Date().toISOString(),
    merchant,
    paymentMode,
    bankName: bName,
    accountEnding: accEnd,
    availableBalance: getAvailableBalance(body),
    source: 'sms',
    rawSms: body,
  };
}

// ─── Permission helpers ───────────────────────────────────────────────────────

async function checkSmsPermission() {
  try {
    if (!MessageReader) return false;
    const r = await MessageReader.checkPermissions();
    return r?.messages === 'granted';
  } catch (e) {
    console.warn('[AutoScan] checkPermissions error:', e);
    return false;
  }
}

async function requestSmsPermission() {
  try {
    if (!MessageReader) return false;
    const r = await MessageReader.requestPermissions();
    return r?.messages === 'granted';
  } catch (e) {
    console.warn('[AutoScan] requestPermissions error:', e);
    return false;
  }
}

// ─── Read SMS inbox ───────────────────────────────────────────────────────────

async function readSmsInbox() {
  if (!MessageReader) {
    console.error('[AutoScan] MessageReader plugin is NULL');
    return [];
  }
  let granted = await checkSmsPermission();
  if (!granted) {
    console.warn('[AutoScan] SMS not granted, requesting...');
    granted = await requestSmsPermission();
  }
  if (!granted) {
    console.error('[AutoScan] SMS permission denied');
    return [];
  }
  const minDate = Date.now() - 90 * 24 * 60 * 60 * 1000;
  let messages = [];
  try {
    const raw = await MessageReader.getMessages({ minDate, limit: 500 });
    messages = raw?.messages || [];
    console.log('[AutoScan] Raw SMS count:', messages.length);
  } catch (e) {
    console.error('[AutoScan] getMessages failed:', e?.message);
    return [];
  }
  const parsed = messages
    .map(m => parseSms(m.body, parseInt(m.date), m.sender))
    .filter(Boolean);
  console.log('[AutoScan] Parsed financial SMS:', parsed.length);
  return parsed;
}

// ─── Read notifications ───────────────────────────────────────────────────────

async function readNotifications() {
  const minDate = Date.now() - 30 * 24 * 60 * 60 * 1000;
  try {
    const status = await NotificationListener.isListenerEnabled();
    if (!status?.enabled) {
      console.warn('[AutoScan] Notification listener not enabled');
      return [];
    }
    const { notifications = [] } = await NotificationListener.getCapturedNotifications({ minDate: minDate });
    console.log('[AutoScan] Raw notification count:', notifications.length);
    const parsed = notifications.map(n => {
      const body = n.body || n.text || n.content || '';
      const date = parseInt(n.date || n.timestamp || Date.now());
      return parseSms(body, date, n.title) || parseUpiNotification(body, date);
    }).filter(Boolean);
    console.log('[AutoScan] Parsed financial notifications:', parsed.length);
    return parsed;
  } catch (e) {
    console.warn('[AutoScan] getCapturedNotifications error:', e);
    return [];
  }
}

// ─── Deduplication ───────────────────────────────────────────────────────────

function isDuplicate(existingTransactions, candidate) {
  return existingTransactions.some(t => {
    let sameDateWindow = false;
    if (t.source !== 'sms') {
      // PDF transactions have no exact time, so we just check if it's the same day
      const tDate = t.date.split('T')[0];
      const candDate = candidate.date.split('T')[0];
      sameDateWindow = (tDate === candDate);
    } else {
      // SMS-to-SMS check uses the 60-second window
      sameDateWindow = Math.abs(new Date(t.date) - new Date(candidate.date)) < 60 * 1000;
    }
    
    const sameAmount = Math.abs(t.amount - candidate.amount) < 0.01;
    const sameType = t.type === candidate.type;
    const sameBank = t.bankName === candidate.bankName;
    const sameAccount = (t.accountEnding == null || candidate.accountEnding == null) 
      ? true 
      : t.accountEnding === candidate.accountEnding;
      
    return sameDateWindow && sameAmount && sameType && sameBank && sameAccount;
  });
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function autoScanTransactions(existingTransactions = []) {
  if (!Capacitor.isNativePlatform()) return { newTransactions: [], needsSetup: false };

  const allParsed = [];
  let smsBlocked = false;

  // SMS path
  try {
    let granted = await checkSmsPermission();
    if (!granted) granted = await requestSmsPermission();
    if (granted) {
      const smsTxns = await readSmsInbox();
      smsTxns.forEach(t => allParsed.push(t));
    } else {
      smsBlocked = true;
    }
  } catch (e) {
    console.warn('[AutoScan] SMS path error:', e);
    smsBlocked = true;
  }

  // Notification Listener path
  try {
    if (!NotificationListener) throw new Error('NotificationListener plugin missing');
    const { enabled } = await NotificationListener.isListenerEnabled();
    if (enabled) {
      const notifTxns = await readNotifications();
      notifTxns.forEach(t => allParsed.push(t));
      if (notifTxns.length === 0 && smsBlocked) return { newTransactions: [], needsSetup: false };
    } else if (smsBlocked) {
      return { newTransactions: [], needsSetup: true };
    }
  } catch (e) {
    console.warn('[AutoScan] Notification listener error:', e);
    if (smsBlocked && allParsed.length === 0) return { newTransactions: [], needsSetup: true };
  }

  if (allParsed.length === 0) return { newTransactions: [], needsSetup: false };

  // Consensus engine — fix misidentified bank names via majority vote per account ending
  const accountBankMap = {};
  [...existingTransactions, ...allParsed].forEach(t => {
    if (!t.accountEnding || t.accountEnding === 'null' || t.bankName === 'Bank Account') return;
    if (!accountBankMap[t.accountEnding]) accountBankMap[t.accountEnding] = {};
    accountBankMap[t.accountEnding][t.bankName] = (accountBankMap[t.accountEnding][t.bankName] || 0) + 1;
  });
  const trueBankNames = {};
  for (const ending in accountBankMap) {
    let maxCount = 0, bestBank = null;
    for (const bank in accountBankMap[ending]) {
      if (accountBankMap[ending][bank] > maxCount) { maxCount = accountBankMap[ending][bank]; bestBank = bank; }
    }
    if (bestBank) trueBankNames[ending] = bestBank;
  }
  allParsed.forEach(t => {
    if (t.accountEnding && trueBankNames[t.accountEnding]) t.bankName = trueBankNames[t.accountEnding];
  });

  const newTransactions = [];
  for (const t of allParsed) {
    if (!isDuplicate(existingTransactions, t) && !isDuplicate(newTransactions, t)) {
      newTransactions.push(t);
    }
  }

  console.log(`[AutoScan] ${allParsed.length} parsed, ${newTransactions.length} new unique`);
  return { newTransactions, totalScanned: allParsed.length, needsSetup: false };
}

export function autoCategory(description, type, cats) {
  if (!cats || cats.length === 0) return '';
  const low = (description || '').toLowerCase();
  const RULES = [
    { kw: ['zomato', 'swiggy', 'food', 'restaurant', 'chai', 'cafe'], cw: ['food', 'dining'] },
    { kw: ['petrol', 'fuel', 'uber', 'ola', 'auto', 'cab', 'rapido'], cw: ['transport', 'travel'] },
    { kw: ['netflix', 'spotify', 'prime', 'movie'], cw: ['entertainment'] },
    { kw: ['doctor', 'hospital', 'medicine', 'pharmacy'], cw: ['health', 'medical'] },
    { kw: ['salary', 'payroll'], cw: ['salary', 'income'] },
    { kw: ['atm', 'cash withdrawal'], cw: ['cash'] },
  ];
  const typeCats = cats.filter(c => c.type === type);
  for (const { kw, cw } of RULES) {
    if (kw.some(k => low.includes(k))) {
      const match = typeCats.find(c => cw.some(w => c.name.toLowerCase().includes(w)));
      if (match) return match.id;
    }
  }
  return typeCats[0]?.id || '';
}
