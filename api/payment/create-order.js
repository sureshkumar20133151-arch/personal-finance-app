import { requireAuth } from "../_lib/firebaseAdmin.js";
import { getRazorpayClient } from "../_lib/razorpay.js";
import { PLAN_AMOUNTS_PAISE, PLAN_NAMES } from "../_lib/plans.js";
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

  const { planType } = req.body || {};
  const amount = PLAN_AMOUNTS_PAISE[planType];
  if (!amount) {
    return res.status(400).json({ error: "Invalid planType" });
  }

  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `${decoded.uid}_${planType}_${Date.now()}`,
      notes: { uid: decoded.uid, planType },
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planName: PLAN_NAMES[planType],
    });
  } catch (err) {
    console.error("create-order failed", err);
    return res.status(500).json({ error: "Could not create payment order" });
  }
}
