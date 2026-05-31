/**
 * SMS Parser Utility for Indian Banks & Financial Transaction Messages
 * Extracts amount, type, payment mode, and merchant/receiver details from transaction SMS.
 */

// Regex patterns for detecting debit (expense) and credit (income) amounts
const DEBIT_REGEXES = [
    /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has\s+been\s+)?(?:debited|spent|withdrawn|transferred|paid|deducted)/i,
    /(?:debited|spent|paid|withdrawn|deducted)\s*(?:for|by|of)?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /sent\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*to/i
];

const CREDIT_REGEXES = [
    /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has\s+been\s+)?(?:credited|deposited|received)/i,
    /(?:credited|deposited|received)\s*(?:for|by|of)?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i
];

// Regex for extracting merchant / reference names
const MERCHANT_REGEXES = [
    /(?:at|to|towards|vpa|info|transfer\s+to|paid\s+to)\s+([a-zA-Z0-9\s\-_\.\*@]+?)(?:\s+on|\s+via|\s+using|\s+ref|\s+info|\s+balance|\s+date|\s*\.|\s*$)/i,
    /(?:merchant|ref|txn)\s+(?:name\s+)?([a-zA-Z0-9\s\-_\.\*@]{3,25})/i
];

/**
 * Parses an incoming SMS text and extracts transaction details if found.
 * @param {string} body - The SMS message body.
 * @param {number} timestamp - The SMS timestamp (milliseconds since epoch).
 * @returns {object|null} The parsed transaction object, or null if not a transaction message.
 */
export const parseTransactionSMS = (body, timestamp) => {
    if (!body) return null;

    let amount = null;
    let type = null;
    let description = 'Online Transaction';
    let paymentMode = 'upi'; // Default to UPI for convenience in India

    // 1. Try to match Debit patterns (Expense)
    for (const regex of DEBIT_REGEXES) {
        const match = body.match(regex);
        if (match && match[1]) {
            amount = parseFloat(match[1].replace(/,/g, ''));
            type = 'expense';
            break;
        }
    }

    // 2. Try to match Credit patterns (Income)
    if (!amount) {
        for (const regex of CREDIT_REGEXES) {
            const match = body.match(regex);
            if (match && match[1]) {
                amount = parseFloat(match[1].replace(/,/g, ''));
                type = 'income';
                break;
            }
        }
    }

    // If no transaction amount detected, ignore this SMS
    if (!amount || isNaN(amount)) return null;

    // 3. Extract Merchant / Vendor Description
    for (const regex of MERCHANT_REGEXES) {
        const match = body.match(regex);
        if (match && match[1]) {
            const cleaned = match[1].trim();
            // Filter out junk numbers/reference codes
            if (cleaned.length > 2 && !/^\d+$/.test(cleaned)) {
                description = cleaned;
                break;
            }
        }
    }

    // Clean up description if it's too long or has trailing junk
    description = description.replace(/\s+/g, ' ');
    if (description.length > 30) {
        description = description.substring(0, 27) + '...';
    }

    // 4. Detect Payment Mode
    const bodyLower = body.toLowerCase();
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

    return {
        amount,
        description,
        type,
        date: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        paymentMode,
        rawSms: body // Keep raw text for debug verification
    };
};
