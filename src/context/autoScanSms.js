// autoScanSms.js — Definitive Fix (June 2026)
// Bug fixed: SMS returned 0 results silently when listener is OFF and SMS works.
// Bug fixed: Dedup by date+amount+type is too strict — added 60-sec window.
// Bug fixed: SMSScanModal uses V.messages (wrong key on initial check).

import { Capacitor } from '@capacitor/core';

const MessageReader = Capacitor.isNativePlatform()
  ? (() => { try { return window.Capacitor.Plugins.MessageReader; } catch { return null; } })()
  : null;

const NotificationListener = Capacitor.isNativePlatform()
  ? (() => { try { return window.Capacitor.Plugins.NotificationListener; } catch { return null; } })()
  : null;

// ─── Regex Patterns ─────────────────────────────────────────────────────────
const DEBIT_PATTERNS = [
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has\s+been\s+)?(?:debited|spent|withdrawn|transferred|transfer|paid|deducted|sent|charged|charge)/i,
  /(?:debited|spent|paid|withdrawn|deducted|sent|transferred|transfer|charged|charge)\s*(?:for|by|of|with|towards)?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /sent\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*to/i,
  /dr\.?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*dr/i,
  /debited\s+with\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /txn\s+of\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+debited/i,
  /payment\s+of\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
];

const CREDIT_PATTERNS = [
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has\s+been\s+)?(?:credited|deposited|received|added|refunded)/i,
  /(?:credited|deposited|received|added|refunded)\s*(?:for|by|of|with|towards)?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:sent|transferred|paid)\s+you\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  // NEW: "Cr Rs 500" pattern
  /cr\.?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*cr/i,
];

const MERCHANT_PATTERN = /(?:at|to|towards|vpa|info|transfer\s+to|paid\s+to)\s+([a-zA-Z0-9\s\-_\.\\*@\/,\(\)]+?)(?:\s+(?:on|via|using|ref|info|balance|date)|[.,]|\s*|$)/gi;
const MERCHANT_ALT_PATTERN = /(?:merchant|ref|txn)\s+(?:name\s+)?([a-zA-Z0-9\s\-_\.\\*@\/,\(\)]{3,25})/gi;
const MERCHANT_INDIAN_BANK = /\bto\s+([A-Z][A-Z\s\.]{2,20}?)\s*\.\s*UPI:/ig;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isValidMerchant(str) {
  if (!str) return false;
  const s = str.trim();
  if (s.length < 2) return false;
  const low = s.toLowerCase();
  if (low.includes('a/c') || low.includes('acct') || low.includes('account') || low.includes('card') || low.includes('ending')) return false;
  const digits = s.replace(/\D/g, '');
  return !(digits.length > 0 && digits.length >= s.length * 0.7);
}

function getBankName(sms, sender = '') {
  const text = sms.toLowerCase();
  const snd = sender.toLowerCase();

  // 1. Highly reliable detection from SENDER ID
  if (snd.includes('indbnk') || snd.includes('indian')) return 'Indian Bank';
  if (snd.includes('canbka') || snd.includes('canara')) return 'Canara Bank';
  if (snd.includes('sbiinb') || snd.includes('sbi')) return 'SBI';
  if (snd.includes('hdfcbk') || snd.includes('hdfc')) return 'HDFC Bank';
  if (snd.includes('icicib') || snd.includes('icici')) return 'ICICI Bank';
  if (snd.includes('axisbk') || snd.includes('axis')) return 'Axis Bank';
  if (snd.includes('kotak')) return 'Kotak Bank';
  if (snd.includes('pnb')) return 'PNB';
  if (snd.includes('bob')) return 'Bank of Baroda';

  // 2. Fallback to SMS Body (less reliable, can be confused by transaction memos)
  // ⚠️ ORDER MATTERS — check specific names before short ones
  if (text.includes('indian bank') || text.includes('ind bank') || text.includes('indianbank')) return 'Indian Bank';
  if (text.includes('canara') || text.includes('cnrb')) return 'Canara Bank';
  if (text.includes('kotak mahindra') || text.includes('kotak')) return 'Kotak Bank';
  if (text.includes('axis bank') || text.includes('axis')) return 'Axis Bank';
  if (text.includes('hdfc bank') || text.includes('hdfc')) return 'HDFC Bank';
  if (text.includes('icici bank') || text.includes('icici')) return 'ICICI Bank';
  if (text.includes('punjab national') || text.includes('pnb')) return 'PNB';
  if (text.includes('bank of baroda') || text.includes('bob')) return 'Bank of Baroda';
  if (text.includes('union bank')) return 'Union Bank';
  if (text.includes('central bank')) return 'Central Bank';
  if (text.includes('paytm') || text.includes('ppbl')) return 'Paytm Bank';
  if (text.includes('airtel') || text.includes('apbl')) return 'Airtel Bank';
  
  // ✅ SBI last — "sbi" is 3 chars and can false-match
  if (text.includes('state bank') || text.includes('sbi') || text.includes('yono')) return 'SBI';
  
  return 'Bank Account';
}

function getAccountEnding(body) {
  // Match A/c *4945 or A/c XX4945 or Acct ending 4945 etc.
  const patterns = [
    /a\/c\s*[*Xx•]+(\d{4})\b/i,        // A/c *4945
    /a\/c\s*[*Xx•]*(\d{3,4})\b/i,      // A/c 4945
    /acct?\s*(?:no\.?)?\s*[*Xx•]*(\d{4})\b/i,  // Acct 4945
    /account\s*(?:no\.?)?\s*[*Xx•]*(\d{4})\b/i,
    /ending\s+(?:in\s+)?(\d{4})\b/i,
    /x{2,}(\d{4})\b/i,                 // XX4945 → 4945
  ];
  
  for (const p of patterns) {
    const m = body.match(p);
    if (m?.[1]) {
      // Normalize to last 3 digits to merge accounts like "128" and "9128"
      return m[1].length >= 3 ? m[1].slice(-3) : m[1];
    }
  }
  return null;
}

export function parseSms(body, dateMs, sender = '') {
  if (!body) return null;
  const low = body.toLowerCase();

  // Skip failed/declined
  if (low.includes('failed') || low.includes('declined') || low.includes('insufficient') ||
      low.includes('unsuccessful') || low.includes('rejected')) return null;

  // Must mention a bank keyword to avoid OTP / promo SMS
  const bankKeywordRegex = /\b(a\/c|acct|account|balance|debited|credited|dr\b|cr\b|inr|rs\.?|₹|upi|neft|imps|rtgs|netbanking|atm)\b/i;
  if (!bankKeywordRegex.test(body)) return null;

  let amount = null;
  let type = null;

  for (const p of DEBIT_PATTERNS) {
    const m = body.match(p);
    if (m) {
      const val = (m[1] || m[2] || '').replace(/,/g, '');
      if (val) { amount = parseFloat(val); type = 'expense'; break; }
    }
  }

  if (!amount) {
    for (const p of CREDIT_PATTERNS) {
      const m = body.match(p);
      if (m) {
        const val = (m[1] || m[2] || '').replace(/,/g, '');
        if (val) { amount = parseFloat(val); type = 'income'; break; }
      }
    }
  }

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
    merchant = merchant.split('(')[0].trim().replace(/^vpa\s+/i, '').replace(/[.,\s]+$/, '').trim();
    description = merchant;
  }
  description = description.replace(/\s+/g, ' ');
  if (description.length > 30) description = description.substring(0, 27) + '...';

  // Payment mode
  let paymentMode = 'upi';
  if (low.includes('atm') || low.includes('cash withdrawal')) { paymentMode = 'cash'; description = 'ATM Cash Withdrawal'; }
  else if (low.includes('card') || low.includes('debitcard') || low.includes('creditcard') || low.includes('ending in')) paymentMode = 'card';
  else if (low.includes('netbanking') || low.includes('internet banking') || low.includes('imps') || low.includes('neft') || low.includes('rtgs')) paymentMode = 'netbanking';
  else if (low.includes('upi') || low.includes('gpay') || low.includes('phonepe') || low.includes('paytm') || low.includes('amazonpay')) paymentMode = 'upi';

  return {
    amount,
    description,
    type,
    id: crypto.randomUUID(),
    date: dateMs ? new Date(dateMs).toISOString() : new Date().toISOString(),
    merchant,
    paymentMode,
    bankName: getBankName(body, sender),
    accountEnding: getAccountEnding(body),
    source: 'sms',
    rawSms: body,
  };
}

// ─── Permission helpers ───────────────────────────────────────────────────────
async function checkSmsPermission() {
  try {
    if (!MessageReader) return false;
    const r = await MessageReader.checkPermissions();
    console.log('[AutoScan] checkPermissions:', JSON.stringify(r));
    // ✅ Plugin returns { messages: PermissionState } — key is "messages"
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
    console.log('[AutoScan] requestPermissions:', JSON.stringify(r));
    // ✅ Same key: { messages: PermissionState }
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

  // ✅ minDate as number (milliseconds), 90 days back
  const minDate = Date.now() - 90 * 24 * 60 * 60 * 1000;

  let messages = [];
  try {
    const raw = await MessageReader.getMessages({ minDate, limit: 500 });
    // ✅ Plugin returns { messages: MessageObject[] }
    messages = raw?.messages || [];
    console.log('[AutoScan] Raw SMS count:', messages.length);
    if (messages[0]) {
      console.log('[AutoScan] Sample keys:', Object.keys(messages[0]));
      console.log('[AutoScan] Sample body:', messages[0].body);
      console.log('[AutoScan] Sample date:', messages[0].date);
      console.log('[AutoScan] Sample sender:', messages[0].sender);
    }
  } catch (e) {
    console.error('[AutoScan] getMessages failed:', e?.message);
    return [];
  }

  // ✅ pass sender ID to parseSms for highly accurate bank detection
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
    // Add safety check
    const status = await NotificationListener.isListenerEnabled();
    if (!status?.enabled) {
      console.warn('[AutoScan] Notification listener not enabled');
      return [];
    }
    
    const { notifications = [] } = await NotificationListener.getCapturedNotifications({ minDate: String(minDate) });
    console.log('[AutoScan] Raw notification count:', notifications.length);
    const parsed = notifications.map(n => parseSms(n.body, parseInt(n.date), n.title)).filter(Boolean);
    console.log('[AutoScan] Parsed financial notifications:', parsed.length);
    return parsed;
  } catch (e) {
    console.warn('[AutoScan] getCapturedNotifications error:', e);
    return [];
  }
}

// ─── Deduplication ───────────────────────────────────────────────────────────
// FIX: Use 60-second window instead of exact date match (SMS timestamps vary by seconds)
function isDuplicate(existingTransactions, candidate) {
  return existingTransactions.some(t => {
    const sameDateWindow = Math.abs(new Date(t.date) - new Date(candidate.date)) < 60 * 1000;
    const sameAmount = Math.abs(t.amount - candidate.amount) < 0.01;
    const sameType = t.type === candidate.type;
    const sameBank = t.bankName === candidate.bankName;
    const sameAccount = t.accountEnding === candidate.accountEnding;
    return sameDateWindow && sameAmount && sameType && sameBank && sameAccount;
  });
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function autoScanTransactions(existingTransactions = []) {
  if (!Capacitor.isNativePlatform()) return { newTransactions: [], needsSetup: false };

  const allParsed = [];
  let smsBlocked = false;

  // ── SMS path ──
  try {
    let granted = await checkSmsPermission();
    if (!granted) {
      console.log('[AutoScan] SMS not granted — requesting...');
      granted = await requestSmsPermission();
    }
    if (granted) {
      const smsTxns = await readSmsInbox();
      smsTxns.forEach(t => allParsed.push(t));
      console.log('[AutoScan] SMS path total:', allParsed.length);
    } else {
      smsBlocked = true;
      console.log('[AutoScan] SMS permission denied after request');
    }
  } catch (e) {
    console.warn('[AutoScan] SMS path error:', e);
    smsBlocked = true;
  }

  // ── Notification Listener path ──
  try {
    if (!NotificationListener) throw new Error('NotificationListener plugin missing');
    const { enabled } = await NotificationListener.isListenerEnabled();
    console.log('[AutoScan] Notification listener enabled:', enabled);
    if (enabled) {
      const notifTxns = await readNotifications();
      notifTxns.forEach(t => allParsed.push(t));
      if (notifTxns.length === 0 && smsBlocked) {
        // Listener active but no data yet — first launch
        return { newTransactions: [], needsSetup: false };
      }
    } else if (smsBlocked) {
      // SMS blocked + listener not set up → show setup UI
      return { newTransactions: [], needsSetup: true };
    }
  } catch (e) {
    console.warn('[AutoScan] Notification listener error:', e);
    if (smsBlocked && allParsed.length === 0) {
      return { newTransactions: [], needsSetup: true };
    }
  }

  if (allParsed.length === 0) return { newTransactions: [], needsSetup: false };

  // ── Consensus Engine for false positives ──
  // Fixes UPI notifications (e.g., GPay) falsely matching 'SBI' when transferring to an SBI user.
  const accountBankMap = {};
  const allTxForConsensus = [...existingTransactions, ...allParsed];
  
  allTxForConsensus.forEach(t => {
    if (!t.accountEnding || t.accountEnding === 'null' || t.bankName === 'Bank Account') return;
    if (!accountBankMap[t.accountEnding]) accountBankMap[t.accountEnding] = {};
    accountBankMap[t.accountEnding][t.bankName] = (accountBankMap[t.accountEnding][t.bankName] || 0) + 1;
  });

  const trueBankNames = {};
  for (const ending in accountBankMap) {
    let maxCount = 0;
    let bestBank = null;
    for (const bank in accountBankMap[ending]) {
      if (accountBankMap[ending][bank] > maxCount) {
        maxCount = accountBankMap[ending][bank];
        bestBank = bank;
      }
    }
    if (bestBank) trueBankNames[ending] = bestBank;
  }

  // Apply true bank names to fix misidentified transactions
  allParsed.forEach(t => {
    if (t.accountEnding && trueBankNames[t.accountEnding]) {
      t.bankName = trueBankNames[t.accountEnding];
    }
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
