// ─────────────────────────────────────────────────────────────
//  smsParser.js  — Exact bank SMS parser from your APK bundle
// ─────────────────────────────────────────────────────────────

const DEBIT_PATTERNS = [
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has\s+been\s+)?(?:debited|spent|withdrawn|transferred|paid|deducted|sent)/i,
  /(?:debited|spent|paid|withdrawn|deducted|sent)\s*(?:for|by|of)?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /sent\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*to/i,
];

const CREDIT_PATTERNS = [
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has\s+been\s+)?(?:credited|deposited|received)/i,
  /(?:credited|deposited|received)\s*(?:for|by|of)?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:sent|transferred|paid)\s+you\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
];

const MERCHANT_PATTERN =
  /(?:at|to|towards|vpa|info|transfer\s+to|paid\s+to)\s+([a-zA-Z0-9\s\-_\.\*@/,\(\)]+?)(?:\s+(?:on|via|using|ref|info|balance|date)|[\.,]|\s*|$)/gi;

const MERCHANT_REF_PATTERN =
  /(?:merchant|ref|txn)\s+(?:name\s+)?([a-zA-Z0-9\s\-_\.\*@/,\(\)]{3,25})/gi;

function isValidMerchant(name) {
  if (!name) return false;
  const s = name.trim();
  if (s.length < 2) return false;
  const lower = s.toLowerCase();
  if (
    lower.includes("a/c") || lower.includes("acct") ||
    lower.includes("account") || lower.includes("card") ||
    lower.includes("ending")
  ) return false;
  const digits = s.replace(/\D/g, "");
  return !(digits.length > 0 && digits.length >= s.length * 0.7);
}

export function detectBankName(sms) {
  const text = sms.toLowerCase();
  
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
  if (text.includes('gpay') || text.includes('google pay')) return 'GPay';
  if (text.includes('phonepe')) return 'PhonePe';
  
  // ✅ SBI last — "sbi" is 3 chars and can false-match
  if (text.includes('state bank') || text.includes('sbi') || text.includes('yono')) return 'SBI';
  
  return 'Bank Account';
}

export function extractAccountEnding(sms) {
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
    const m = sms.match(p);
    if (m?.[1]) return m[1]; // always returns exactly last digits match
  }
  return null;
}

export function parseSms(body, timestamp) {
  if (!body) return null;
  const lower = body.toLowerCase();

  if (
    lower.includes("failed") || lower.includes("declined") ||
    lower.includes("insufficient") || lower.includes("unsuccessful") ||
    lower.includes("rejected")
  ) return null;

  let amount = null;
  let type = null;
  let description = "Online Transaction";
  let paymentMode = "upi";

  for (const p of DEBIT_PATTERNS) {
    const m = body.match(p);
    if (m) {
      const val = m[1] || m[2];
      if (val) { amount = parseFloat(val.replace(/,/g, "")); type = "expense"; break; }
    }
  }

  if (!amount) {
    for (const p of CREDIT_PATTERNS) {
      const m = body.match(p);
      if (m) {
        const val = m[1] || m[2];
        if (val) { amount = parseFloat(val.replace(/,/g, "")); type = "income"; break; }
      }
    }
  }

  if (!amount || isNaN(amount)) return null;

  let merchant = null;
  const mm = [...body.matchAll(MERCHANT_PATTERN)];
  for (const m of mm) {
    if (m?.[1]) { const n = m[1].trim(); if (isValidMerchant(n)) { merchant = n; break; } }
  }
  if (!merchant) {
    const rm = [...body.matchAll(MERCHANT_REF_PATTERN)];
    for (const m of rm) {
      if (m?.[1]) { const n = m[1].trim(); if (isValidMerchant(n)) { merchant = n; break; } }
    }
  }

  if (merchant) {
    merchant = merchant.split("(")[0].trim();
    merchant = merchant.replace(/^vpa\s+/i, "");
    merchant = merchant.replace(/[.,\s]+$/, "").trim();
    description = merchant;
  }

  description = description.replace(/\s+/g, " ");
  if (description.length > 30) description = description.substring(0, 27) + "...";

  if (lower.includes("atm") || lower.includes("cash withdrawal")) {
    paymentMode = "cash"; description = "ATM Cash Withdrawal";
  } else if (lower.includes("card") || lower.includes("debitcard") || lower.includes("creditcard") || lower.includes("spent on your") || lower.includes("ending in")) {
    paymentMode = "card";
  } else if (lower.includes("netbanking") || lower.includes("internet banking") || lower.includes("imps") || lower.includes("neft") || lower.includes("rtgs")) {
    paymentMode = "netbanking";
  } else if (lower.includes("upi") || lower.includes("gpay") || lower.includes("phonepe") || lower.includes("paytm") || lower.includes("amazonpay")) {
    paymentMode = "upi";
  }

  return {
    amount,
    description,
    type,
    date: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
    paymentMode,
    bankName: detectBankName(body),
    accountEnding: extractAccountEnding(body),
    rawSms: body,
  };
}
