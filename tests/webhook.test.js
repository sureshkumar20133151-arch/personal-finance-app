import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyWebhookSignature } from '../api/payment/webhook.js';

describe('Payment Webhook Signature Verification', () => {
  const secret = 'webhook_secret_key_12345';
  const rawPayload = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_123',
          amount: 10000,
        },
      },
    },
  });

  it('validates a valid HMAC SHA256 signature', () => {
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(rawPayload)
      .digest('hex');

    const isValid = verifyWebhookSignature(rawPayload, validSignature, secret);
    expect(isValid).toBe(true);
  });

  it('rejects an invalid or tampered signature', () => {
    const fakeSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const isValid = verifyWebhookSignature(rawPayload, fakeSignature, secret);
    expect(isValid).toBe(false);
  });

  it('rejects tampered payload with original signature', () => {
    const signature = crypto
      .createHmac('sha256', secret)
      .update(rawPayload)
      .digest('hex');

    const tamperedPayload = rawPayload.replace('10000', '90000');
    const isValid = verifyWebhookSignature(tamperedPayload, signature, secret);
    expect(isValid).toBe(false);
  });

  it('handles empty or missing parameters safely without crashing', () => {
    expect(verifyWebhookSignature('', '', '')).toBe(false);
    expect(verifyWebhookSignature(rawPayload, null, secret)).toBe(false);
    expect(verifyWebhookSignature(rawPayload, 'short', secret)).toBe(false);
  });
});
