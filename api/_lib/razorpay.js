import Razorpay from "razorpay";
import crypto from "crypto";

const DEFAULT_KEY_ID = "rzp_live_TbaEqXiggkCFdn";
const DEFAULT_KEY_SECRET = "lskN2g7hFhZTyzE5jff5hwaR";

export function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || DEFAULT_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET || DEFAULT_KEY_SECRET;
  return new Razorpay({ key_id, key_secret });
}

export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const key_secret = process.env.RAZORPAY_KEY_SECRET || DEFAULT_KEY_SECRET;
  const expected = crypto
    .createHmac("sha256", key_secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
