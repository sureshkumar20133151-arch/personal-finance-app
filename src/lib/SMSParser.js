/**
 * SMS Parser Utility for Indian Banks & Financial Transaction Messages
 * Extracts amount, type, payment mode, and merchant/receiver details from transaction SMS.
 */

// Regex patterns for detecting debit (expense) and credit (income) amounts
const DEBIT_REGEXES = [
    /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has\s+been\s+)?(?:debited|spent|withdrawn|transferred|paid|deducted|sent)/i,
    /(?:debited|spent|paid|withdrawn|deducted|sent)\s*(?:for|by|of)?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /sent\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*to/i
];

const CREDIT_REGEXES = [
    /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has\s+been\s+)?(?:credited|deposited|received)/i,
    /(?:credited|deposited|received)\s*(?:for|by|of)?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:sent|transferred|paid)\s+you\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i
];

// Regex for extracting merchant / reference names (global for matchAll)
const MERCHANT_REGEX_GLOBAL_1 = /(?:at|to|towards|vpa|info|transfer\s+to|paid\s+to)\s+([a-zA-Z0-9\s\-_\.\*@/,\(\)]+?)(?:\s+(?:on|via|using|ref|info|balance|date)|[\.,]|\s*|$)/ig;
const MERCHANT_REGEX_GLOBAL_2 = /(?:merchant|ref|txn)\s+(?:name\s+)?([a-zA-Z0-9\s\-_\.\*@/,\(\)]{3,25})/ig;

const cleanAndValidateMerchant = (name) => {
    if (!name) return false;
    const trimmed = name.trim();
    if (trimmed.length < 2) return false;
    const lower = trimmed.toLowerCase();
    
    // Ignore if it's the user's account identifier itself
    if (lower.includes('a/c') || lower.includes('acct') || lower.includes('account') || lower.includes('card') || lower.includes('ending')) {
        return false;
    }
    
    // Ignore if it's just a reference number or digits
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length > 0 && digitsOnly.length >= trimmed.length * 0.7) {
        return false;
    }
    
    return true;
};

/**
 * Parses an incoming SMS text and extracts transaction details if found.
 * @param {string} body - The SMS message body.
 * @param {number} timestamp - The SMS timestamp (milliseconds since epoch).
 * @returns {object|null} The parsed transaction object, or null if not a transaction message.
 */
export const parseTransactionSMS = (body, timestamp) => {
    if (!body) return null;

    const bodyLower = body.toLowerCase();
    // Filter out failed, declined, or unsuccessful transactions
    if (bodyLower.includes('failed') || bodyLower.includes('declined') || bodyLower.includes('insufficient') || bodyLower.includes('unsuccessful') || bodyLower.includes('rejected')) {
        return null;
    }

    let amount = null;
    let type = null;
    let description = 'Online Transaction';
    let paymentMode = 'upi'; // Default to UPI for convenience in India

    // 1. Try to match Debit patterns (Expense)
    for (const regex of DEBIT_REGEXES) {
        const match = body.match(regex);
        if (match) {
            const amountStr = match[1] || match[2];
            if (amountStr) {
                amount = parseFloat(amountStr.replace(/,/g, ''));
                type = 'expense';
                break;
            }
        }
    }

    // 2. Try to match Credit patterns (Income)
    if (!amount) {
        for (const regex of CREDIT_REGEXES) {
            const match = body.match(regex);
            if (match) {
                // Try group 1 first, then group 2 (different regex patterns capture in different groups)
                const amountStr = match[1] || match[2];
                if (amountStr) {
                    amount = parseFloat(amountStr.replace(/,/g, ''));
                    type = 'income';
                    break;
                }
            }
        }
    }

    // If no transaction amount detected, ignore this SMS
    if (!amount || isNaN(amount)) return null;

    // 3. Extract Merchant / Vendor Description
    let foundMerchant = null;
    
    const matches1 = [...body.matchAll(MERCHANT_REGEX_GLOBAL_1)];
    for (const match of matches1) {
        if (match && match[1]) {
            const cleaned = match[1].trim();
            if (cleanAndValidateMerchant(cleaned)) {
                foundMerchant = cleaned;
                break;
            }
        }
    }
    
    if (!foundMerchant) {
        const matches2 = [...body.matchAll(MERCHANT_REGEX_GLOBAL_2)];
        for (const match of matches2) {
            if (match && match[1]) {
                const cleaned = match[1].trim();
                if (cleanAndValidateMerchant(cleaned)) {
                    foundMerchant = cleaned;
                    break;
                }
            }
        }
    }

    if (foundMerchant) {
        // Strip trailing parens/VPA prefix/ending punctuation
        foundMerchant = foundMerchant.split('(')[0].trim();
        foundMerchant = foundMerchant.replace(/^vpa\s+/i, '');
        foundMerchant = foundMerchant.replace(/[\.,\s]+$/, '').trim();
        description = foundMerchant;
    }

    // Clean up description if it's too long or has trailing junk
    description = description.replace(/\s+/g, ' ');
    if (description.length > 30) {
        description = description.substring(0, 27) + '...';
    }

    // 4. Detect Payment Mode
    if (bodyLower.includes('atm') || bodyLower.includes('cash withdrawal')) {
        paymentMode = 'cash';
        description = 'ATM Cash Withdrawal';
    } else if (bodyLower.includes('card') || bodyLower.includes('debitcard') || bodyLower.includes('creditcard') || bodyLower.includes('spent on your') || bodyLower.includes('ending in')) {
        paymentMode = 'card';
    } else if (bodyLower.includes('netbanking') || bodyLower.includes('internet banking') || bodyLower.includes('imps') || bodyLower.includes('neft') || bodyLower.includes('rtgs')) {
        paymentMode = 'netbanking';
    } else if (bodyLower.includes('upi') || bodyLower.includes('gpay') || bodyLower.includes('phonepe') || bodyLower.includes('paytm') || bodyLower.includes('amazonpay')) {
        paymentMode = 'upi';
    }

    const bankName = detectBankName(body);
    const accountEnding = detectAccountEnding(body);

    return {
        amount,
        description,
        type,
        date: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        paymentMode,
        bankName,
        accountEnding,
        rawSms: body // Keep raw text for debug verification
    };
};

const detectBankName = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('indian bank') || lower.includes('ind bank') || lower.includes('indianbank')) return 'Indian Bank';
    if (lower.includes('canara') || lower.includes('cnrb')) return 'Canara Bank';
    if (lower.includes('sbi') || lower.includes('state bank') || lower.includes('yono')) return 'SBI';
    if (lower.includes('hdfc')) return 'HDFC Bank';
    if (lower.includes('icici')) return 'ICICI Bank';
    if (lower.includes('axis')) return 'Axis Bank';
    if (lower.includes('kotak')) return 'Kotak Bank';
    if (lower.includes('baroda') || lower.includes('bob')) return 'Bank of Baroda';
    if (lower.includes('pnb') || lower.includes('punjab national')) return 'PNB';
    if (lower.includes('paytm') || lower.includes('ppbl')) return 'Paytm Bank';
    if (lower.includes('airtel') || lower.includes('apbl')) return 'Airtel Bank';
    if (lower.includes('gpay') || lower.includes('google pay')) return 'GPay';
    if (lower.includes('phonepe')) return 'PhonePe';
    return 'Bank Account';
};

const detectAccountEnding = (text) => {
    const regexes = [
        /(?:a\/c|acct|account|card|ending)\s*(?:ending)?\s*(?:in|with)?\s*([xX\*]*\d{3,4})/i,
        /(?:a\/c|acct|account|card)\s*(?:ending)?\s*(?:in|with)?\s*(\d{3,4})/i,
        /ending\s+([xX\*]*\d{3,4})/i,
        /ending\s+in\s+(\d{3,4})/i
    ];
    
    for (const regex of regexes) {
        const match = text.match(regex);
        if (match && match[1]) {
            const digits = match[1].replace(/\D/g, '');
            if (digits.length >= 3) {
                return digits;
            }
        }
    }
    return null;
};
