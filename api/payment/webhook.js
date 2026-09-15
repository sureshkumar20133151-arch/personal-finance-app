import crypto from "crypto";
import { adminDb } from "../_lib/firebaseAdmin.js";
import { fetchRazorpayOrder } from "../_lib/razorpay.js";
import { PLAN_AMOUNTS_PAISE } from "../_lib/plans.js";

// This endpoint is called server-to-server by Razorpay, not by the app, so
// it deliberately does NOT go through requireAuth() or applyCors() — there
// is no Firebase ID token to check and no browser origin involved. Trust is
// established entirely by the HMAC signature check below.
//
// Setup (one-time, in the Razorpay Dashboard -> Settings -> Webhooks):
//   1. Add webhook URL: https://<your-domain>/api/payment/webhook
//   2. Subscribe to the `payment.captured` event.
//   3. Razorpay generates a webhook secret at that point — copy it into
//      the RAZORPAY_WEBHOOK_SECRET env var on Vercel. This is a DIFFERENT
//      secret from RAZORPAY_KEY_SECRET (the API key secret) — don't reuse it.
//
// Body parsing is disabled because the signature must be computed over the
// exact raw bytes Razorpay sent; parsing to JSON first and re-serializing
// would very likely produce a byte-for-byte different string and always
// fail verification.
export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function verifyWebhookSignature(rawBody, signature, secret) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[payment/webhook] RAZORPAY_WEBHOOK_SECRET is not configured");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers["x-razorpay-signature"];

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.warn("[payment/webhook] signature verification failed");
    return res.status(400).json({ error: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).json({ error: "Malformed JSON body" });
  }

  // Ack anything we don't act on so Razorpay doesn't keep retrying it.
  if (event.event !== "payment.captured") {
    return res.status(200).json({ received: true, ignored: event.event });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id || !payment?.id) {
    return res.status(400).json({ error: "Malformed payment payload" });
  }

  const db = await adminDb();
  if (!db) {
    console.error("[payment/webhook] adminDb() unavailable — cannot process webhook");
    return res.status(500).json({ error: "Server database not configured" });
  }

  // Idempotency: Razorpay may redeliver the same event (retries, duplicate
  // webhooks for the same payment). Recording the payment id lets us skip
  // reprocessing instead of re-writing the subscription every time.
  const eventRef = db.doc(`processedPaymentEvents/${payment.id}`);
  try {
    const already = await eventRef.get();
    if (already.exists) {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }
  } catch (e) {
    console.warn("[payment/webhook] idempotency check failed, continuing:", e.message);
  }

  try {
    // Defense in depth, same as api/payment/verify.js: don't trust the
    // webhook payload's own `notes` blindly — re-fetch the order from
    // Razorpay's API and cross-check uid/planType/amount/status against it.
    const order = await fetchRazorpayOrder(payment.order_id);
    const { uid, planType } = order.notes || {};

    if (!uid || !planType || !PLAN_AMOUNTS_PAISE[planType]) {
      console.warn("[payment/webhook] order missing/invalid uid or planType", payment.order_id);
      return res.status(400).json({ error: "Order missing uid/planType" });
    }
    if (order.amount !== PLAN_AMOUNTS_PAISE[planType]) {
      console.warn("[payment/webhook] amount mismatch for order", payment.order_id);
      return res.status(400).json({ error: "Order amount mismatch" });
    }
    if (order.status !== "paid") {
      console.warn("[payment/webhook] order not marked paid yet", payment.order_id);
      return res.status(400).json({ error: "Order not marked paid" });
    }

    await db.doc(`users/${uid}`).set(
      { subscription: planType, subscriptionUpdatedAt: new Date().toISOString() },
      { merge: true }
    );
    await eventRef.set({
      uid,
      planType,
      orderId: payment.order_id,
      processedAt: new Date().toISOString(),
    });

    return res.status(200).json({ received: true, uid, subscription: planType });
  } catch (err) {
    console.error("[payment/webhook] processing failed", err);
    // 500 tells Razorpay to retry the webhook later.
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
