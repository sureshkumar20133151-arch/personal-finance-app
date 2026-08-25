import Razorpay from "razorpay";
import crypto from "crypto";

// Required env vars (Vercel Project Settings -> Environment Variables):
//   RAZORPAY_KEY_ID       (same value as VITE_RAZORPAY_KEY_ID on the client)
//   RAZORPAY_KEY_SECRET   (server-only, never exposed to the browser)
export function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET env vars in Vercel.");
  }
  return new Razorpay({ key_id, key_secret });
}

// Recomputes the HMAC-SHA256 signature Razorpay sends back after a successful
// checkout and compares it against what the client reported. This is the
// cryptographic proof that the payment actually happened - it cannot be
// forged without the Key Secret, which only lives on the server.
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  const expected = crypto
    .createHmac("sha256", key_secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
