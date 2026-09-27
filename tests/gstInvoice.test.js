import { describe, it, expect } from 'vitest';
import {
  calculateGstBreakdown,
  generateInvoiceNumber,
  buildGstInvoice,
  SAC_CODE_SAAS,
  GST_RATE,
} from '../api/_lib/gstInvoice.js';

describe('GST Invoice Generator for SaaS (India)', () => {
  it('has valid SAC Code 998314 and 18% GST rate', () => {
    expect(SAC_CODE_SAAS).toBe('998314');
    expect(GST_RATE).toBe(0.18);
  });

  it('correctly calculates Intrastate GST (CGST 9% + SGST 9%) for Tamil Nadu', () => {
    // ₹100 plan = 10,000 paise
    const breakdown = calculateGstBreakdown(10000, 'Tamil Nadu', 'Tamil Nadu');

    expect(breakdown.totalInRupees).toBe(100);
    // Base amount: 100 / 1.18 = 84.75
    expect(breakdown.baseInRupees).toBe(84.75);
    // Tax: 15.25
    expect(breakdown.totalTaxInRupees).toBe(15.25);
    expect(breakdown.isIntrastate).toBe(true);
    expect(breakdown.cgst).toBe(7.63);
    expect(breakdown.sgst).toBe(7.62);
    expect(breakdown.igst).toBe(0);
  });

  it('correctly calculates Interstate GST (IGST 18%) for other states', () => {
    // ₹900 plan = 90,000 paise
    const breakdown = calculateGstBreakdown(90000, 'Karnataka', 'Tamil Nadu');

    expect(breakdown.totalInRupees).toBe(900);
    // Base amount: 900 / 1.18 = 762.71
    expect(breakdown.baseInRupees).toBe(762.71);
    expect(breakdown.totalTaxInRupees).toBe(137.29);
    expect(breakdown.isIntrastate).toBe(false);
    expect(breakdown.cgst).toBe(0);
    expect(breakdown.sgst).toBe(0);
    expect(breakdown.igst).toBe(137.29);
  });

  it('generates properly formatted invoice number INV-YYYYMM-XXXX', () => {
    const invNum = generateInvoiceNumber();
    expect(invNum).toMatch(/^INV-\d{6}-\d{4}$/);
  });

  it('builds a complete structured invoice document', () => {
    const invoice = buildGstInvoice({
      uid: 'user_suresh_123',
      userEmail: 'suresh@example.com',
      userName: 'Suresh Kumar',
      planType: 'yearly',
      amountPaise: 90000,
      paymentId: 'pay_xyz123',
      orderId: 'order_abc456',
      buyerState: 'Tamil Nadu',
      buyerGstin: '',
    });

    expect(invoice.sacCode).toBe('998314');
    expect(invoice.totalAmount).toBe(900);
    expect(invoice.customer.uid).toBe('user_suresh_123');
    expect(invoice.customer.name).toBe('Suresh Kumar');
    expect(invoice.paymentDetails.paymentId).toBe('pay_xyz123');
    expect(invoice.status).toBe('paid');
  });
});
