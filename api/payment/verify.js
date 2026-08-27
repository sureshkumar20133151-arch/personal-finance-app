import { requireAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { getRazorpayClient, verifyPaymentSignature } from "../_lib/razorpay.js";
import { PLAN_AMOUNTS_PAISE } from "../_lib/plans.js";
import { applyCors } from "../_lib/cors.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    planType,
  } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planType) {
    return res.status(400).json({ error: "Missing payment verification fields" });
  }
  if (!PLAN_AMOUNTS_PAISE[planType]) {
    return res.status(400).json({ error: "Invalid planType" });
  }

  // 1. Cryptographic signature check - proves Razorpay actually processed this payment.
  const signatureValid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!signatureValid) {
    return res.status(400).json({ error: "Payment signature verification failed" });
  }

  // 2. Defense in depth: re-fetch the order from Razorpay and cross-check that
  // it was created for THIS user and THIS plan (stops someone reusing a valid
  // order/payment/signature triple that belonged to a different account).
  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.fetch(razorpay_order_id);

    if (order.notes?.uid !== decoded.uid || order.notes?.planType !== planType) {
      return res.status(400).json({ error: "Order does not match this user/plan" });
    }
    if (order.amount !== PLAN_AMOUNTS_PAISE[planType]) {
      return res.status(400).json({ error: "Order amount mismatch" });
    }
    if (order.status !== "paid") {
      return res.status(400).json({ error: "Order is not marked paid by Razorpay" });
    }

    // 3. All checks passed - write the plan server-side (client can no longer
    // set its own subscription field directly for paid plans).
    await adminDb().doc(`users/${decoded.uid}`).set(
      { subscription: planType, subscriptionUpdatedAt: new Date().toISOString() },
      { merge: true }
    );

    return res.status(200).json({ success: true, subscription: planType });
  } catch (err) {
    console.error("payment verify failed", err);
    return res.status(500).json({ error: "Verification failed" });
  }
}
