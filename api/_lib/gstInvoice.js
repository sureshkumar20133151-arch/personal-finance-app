// ─────────────────────────────────────────────────────────────────────────────
//  GST Invoice Generator for SaaS Subscriptions (India)
//  HSN / SAC Code: 998314 (Information Technology Software Services / SaaS)
//  GST Rate: 18% (Intrastate: 9% CGST + 9% SGST | Interstate: 18% IGST)
// ─────────────────────────────────────────────────────────────────────────────

import { PLAN_NAMES } from './plans.js';

export const SAC_CODE_SAAS = '998314';
export const GST_RATE = 0.18; // 18%

// Default Seller Details (can be overridden via process.env)
export const SELLER_DETAILS = {
  businessName: process.env.SELLER_BUSINESS_NAME || 'Budget Tracker Pro',
  address: process.env.SELLER_ADDRESS || 'Chennai, Tamil Nadu, India',
  state: process.env.SELLER_STATE || 'Tamil Nadu',
  stateCode: process.env.SELLER_STATE_CODE || '33', // 33 is Tamil Nadu GST State code
  gstin: process.env.SELLER_GSTIN || 'UNREGISTERED_OR_APPLIED',
  pan: process.env.SELLER_PAN || '',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@budgettracker.app',
};

/**
 * Calculate GST breakdown from total amount in paise (tax inclusive)
 * @param {number} totalAmountPaise - e.g. 10000 for ₹100
 * @param {string} buyerState - state name or code
 * @param {string} sellerState - seller home state (default 'Tamil Nadu')
 */
export function calculateGstBreakdown(
  totalAmountPaise,
  buyerState = 'Tamil Nadu',
  sellerState = 'Tamil Nadu'
) {
  const totalInRupees = totalAmountPaise / 100;
  // Tax Inclusive calculation: Base = Total / (1 + Rate)
  const baseInRupees = Math.round((totalInRupees / (1 + GST_RATE)) * 100) / 100;
  const totalTaxInRupees = Math.round((totalInRupees - baseInRupees) * 100) / 100;

  const isIntrastate =
    (buyerState || '').trim().toLowerCase() === (sellerState || '').trim().toLowerCase();

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isIntrastate) {
    cgst = Math.round((totalTaxInRupees / 2) * 100) / 100;
    sgst = Math.round((totalTaxInRupees - cgst) * 100) / 100;
  } else {
    igst = totalTaxInRupees;
  }

  return {
    totalInRupees,
    baseInRupees,
    totalTaxInRupees,
    isIntrastate,
    cgstRate: isIntrastate ? 0.09 : 0,
    sgstRate: isIntrastate ? 0.09 : 0,
    igstRate: isIntrastate ? 0 : 0.18,
    cgst,
    sgst,
    igst,
  };
}

/**
 * Generate unique serial invoice number
 * Format: INV-YYYYMM-XXXX
 */
export function generateInvoiceNumber(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `INV-${yyyy}${mm}-${randomSuffix}`;
}

/**
 * Build a complete GST Invoice Object
 */
export function buildGstInvoice({
  uid,
  userEmail = '',
  userName = '',
  planType,
  amountPaise,
  paymentId,
  orderId,
  buyerState = 'Tamil Nadu',
  buyerGstin = '',
}) {
  const invoiceDate = new Date();
  const invoiceNumber = generateInvoiceNumber(invoiceDate);
  const planName = PLAN_NAMES[planType] || `${planType.toUpperCase()} Plan`;
  const breakdown = calculateGstBreakdown(amountPaise, buyerState, SELLER_DETAILS.state);

  return {
    invoiceNumber,
    invoiceDate: invoiceDate.toISOString(),
    status: 'paid',
    sacCode: SAC_CODE_SAAS,
    serviceDescription: `Subscription for ${planName} — SaaS Personal Finance Services`,
    currency: 'INR',
    amountPaise,
    totalAmount: breakdown.totalInRupees,
    baseAmount: breakdown.baseInRupees,
    taxAmount: breakdown.totalTaxInRupees,
    taxBreakdown: {
      isIntrastate: breakdown.isIntrastate,
      cgst: breakdown.cgst,
      sgst: breakdown.sgst,
      igst: breakdown.igst,
      cgstRate: breakdown.cgstRate,
      sgstRate: breakdown.sgstRate,
      igstRate: breakdown.igstRate,
    },
    seller: SELLER_DETAILS,
    customer: {
      uid,
      name: userName || 'Subscriber',
      email: userEmail || '',
      state: buyerState,
      gstin: buyerGstin || 'Unregistered',
    },
    paymentDetails: {
      provider: 'Razorpay',
      orderId,
      paymentId,
      paidAt: invoiceDate.toISOString(),
    },
    metadata: {
      planType,
      createdAt: invoiceDate.toISOString(),
    },
  };
}

/**
 * Save invoice to Firestore (both in invoices root collection and user subcollection)
 */
export async function saveInvoiceToDb(db, invoiceData) {
  if (!db) return null;
  const invoiceId = invoiceData.invoiceNumber;

  // 1. Root collection for finance audits
  await db.doc(`invoices/${invoiceId}`).set(invoiceData);

  // 2. User specific subcollection for dashboard invoice download
  if (invoiceData.customer?.uid) {
    await db
      .doc(`users/${invoiceData.customer.uid}/invoices/${invoiceId}`)
      .set(invoiceData);
  }

  return invoiceId;
}
