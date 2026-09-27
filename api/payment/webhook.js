import crypto from "crypto";
import { adminDb } from "../_lib/firebaseAdmin.js";
import { fetchRazorpayOrder } from "../_lib/razorpay.js";
import { PLAN_AMOUNTS_PAISE } from "../_lib/plans.js";
import { buildGstInvoice, saveInvoiceToDb } from "../_lib/gstInvoice.js";

// This endpoint is called server-to-server by Razorpay, not by the app, so
// it deliberately does NOT go through requireAuth() or applyCors() — there
// is no Firebase ID token to check and no browser origin involved. Trust is
// established entirely by the HMAC signature check below.
//
// Webhook Events Handled:
//   - payment.captured: Plan upgrade & GST invoice creation
//   - payment.failed: Log failure, update payment error status for user
//   - subscription.charged / subscription.activated: Recurring renewal & invoice
//   - subscription.cancelled / subscription.halted: Auto-debit fail / cancelled -> downgrade to free
//   - refund.created / refund.processed: Refund processed -> revoke plan to free
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

export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
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

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    console.error("[payment/webhook] Neither RAZORPAY_WEBHOOK_SECRET nor RAZORPAY_KEY_SECRET is configured");
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

  const eventType = event.event;
  const eventId = event.payload?.payment?.entity?.id ||
                  event.payload?.subscription?.entity?.id ||
                  event.payload?.refund?.entity?.id ||
                  `evt_${Date.now()}`;

  const db = await adminDb();
  if (!db) {
    console.error("[payment/webhook] adminDb() unavailable — cannot process webhook");
    return res.status(500).json({ error: "Server database not configured" });
  }

  // Idempotency: Prevent duplicate webhook execution
  const eventRef = db.doc(`processedPaymentEvents/${eventType}_${eventId}`);
  try {
    const already = await eventRef.get();
    if (already.exists) {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }
  } catch (e) {
    console.warn("[payment/webhook] idempotency check failed, continuing:", e.message);
  }

  try {
    switch (eventType) {
      // ───────────────────────────────────────────────────────────────────────
      // 1. PAYMENT CAPTURED (One-time or direct order success)
      // ───────────────────────────────────────────────────────────────────────
      case "payment.captured": {
        const payment = event.payload?.payment?.entity;
        if (!payment?.order_id || !payment?.id) {
          return res.status(400).json({ error: "Malformed payment payload" });
        }

        const order = await fetchRazorpayOrder(payment.order_id);
        const { uid, planType, buyerState, buyerGstin } = order.notes || {};

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

        // Generate GST Invoice (18% GST SAC 998314)
        let invoiceNumber = null;
        try {
          const invoiceData = buildGstInvoice({
            uid,
            userEmail: payment.email || order.notes?.email || "",
            userName: order.notes?.name || "",
            planType,
            amountPaise: order.amount,
            paymentId: payment.id,
            orderId: payment.order_id,
            buyerState: buyerState || "Tamil Nadu",
            buyerGstin: buyerGstin || "",
          });
          invoiceNumber = await saveInvoiceToDb(db, invoiceData);
        } catch (invErr) {
          console.error("[payment/webhook] GST Invoice generation failed:", invErr.message);
        }

        // Update User Profile
        await db.doc(`users/${uid}`).set(
          {
            subscription: planType,
            subscriptionStatus: "active",
            subscriptionUpdatedAt: new Date().toISOString(),
            lastPaymentError: null,
            latestInvoiceNumber: invoiceNumber,
          },
          { merge: true }
        );

        await eventRef.set({
          eventType,
          uid,
          planType,
          orderId: payment.order_id,
          paymentId: payment.id,
          invoiceNumber,
          processedAt: new Date().toISOString(),
        });

        return res.status(200).json({ received: true, uid, subscription: planType, invoiceNumber });
      }

      // ───────────────────────────────────────────────────────────────────────
      // 2. PAYMENT FAILED (Card decline, UPI timeout, bank outage)
      // ───────────────────────────────────────────────────────────────────────
      case "payment.failed": {
        const payment = event.payload?.payment?.entity;
        const notes = payment?.notes || {};
        const uid = notes.uid;

        console.warn(`[payment/webhook] Payment failed: ${payment?.id} for user ${uid}, reason: ${payment?.error_description}`);

        if (uid) {
          await db.doc(`users/${uid}`).set(
            {
              lastPaymentFailure: {
                orderId: payment?.order_id || null,
                paymentId: payment?.id || null,
                errorCode: payment?.error_code || 'PAYMENT_FAILED',
                errorDescription: payment?.error_description || 'Payment was unsuccessful',
                failedAt: new Date().toISOString(),
              },
            },
            { merge: true }
          );
        }

        await eventRef.set({
          eventType,
          uid: uid || null,
          paymentId: payment?.id,
          error: payment?.error_description,
          processedAt: new Date().toISOString(),
        });

        return res.status(200).json({ received: true, loggedFailure: true });
      }

      // ───────────────────────────────────────────────────────────────────────
      // 3. RECURRING SUBSCRIPTION CHARGED / ACTIVATED (Renewal)
      // ───────────────────────────────────────────────────────────────────────
      case "subscription.charged":
      case "subscription.activated": {
        const sub = event.payload?.subscription?.entity;
        const payment = event.payload?.payment?.entity;
        const notes = sub?.notes || payment?.notes || {};
        const uid = notes.uid;
        const planType = notes.planType || "monthly";

        if (uid) {
          // Calculate valid until date
          const currentEnd = sub?.current_end
            ? new Date(sub.current_end * 1000).toISOString()
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          // Generate GST invoice for renewal
          let invoiceNumber = null;
          if (payment?.id && payment?.amount) {
            try {
              const invoiceData = buildGstInvoice({
                uid,
                userEmail: payment.email || "",
                userName: notes.name || "",
                planType,
                amountPaise: payment.amount,
                paymentId: payment.id,
                orderId: payment.order_id || sub.id,
                buyerState: notes.buyerState || "Tamil Nadu",
                buyerGstin: notes.buyerGstin || "",
              });
              invoiceNumber = await saveInvoiceToDb(db, invoiceData);
            } catch (invErr) {
              console.error("[payment/webhook] Subscription GST invoice failed:", invErr.message);
            }
          }

          await db.doc(`users/${uid}`).set(
            {
              subscription: planType,
              subscriptionStatus: "active",
              subscriptionValidUntil: currentEnd,
              subscriptionUpdatedAt: new Date().toISOString(),
              razorpaySubscriptionId: sub?.id || null,
              latestInvoiceNumber: invoiceNumber,
            },
            { merge: true }
          );
        }

        await eventRef.set({
          eventType,
          uid: uid || null,
          subscriptionId: sub?.id,
          processedAt: new Date().toISOString(),
        });

        return res.status(200).json({ received: true, renewed: true, uid });
      }

      // ───────────────────────────────────────────────────────────────────────
      // 4. SUBSCRIPTION CANCELLED / HALTED (e-Mandate exhausted or user cancel)
      // ───────────────────────────────────────────────────────────────────────
      case "subscription.cancelled":
      case "subscription.halted": {
        const sub = event.payload?.subscription?.entity;
        const notes = sub?.notes || {};
        const uid = notes.uid;

        console.info(`[payment/webhook] Subscription ${sub?.id} cancelled/halted for uid: ${uid}`);

        if (uid) {
          await db.doc(`users/${uid}`).set(
            {
              subscription: "free",
              subscriptionStatus: "cancelled",
              subscriptionCancelledAt: new Date().toISOString(),
              cancellationReason: sub?.cancel_reason || "Subscription halted or cancelled",
            },
            { merge: true }
          );
        }

        await eventRef.set({
          eventType,
          uid: uid || null,
          subscriptionId: sub?.id,
          processedAt: new Date().toISOString(),
        });

        return res.status(200).json({ received: true, cancelled: true, uid });
      }

      // ───────────────────────────────────────────────────────────────────────
      // 5. REFUND PROCESSED / CREATED
      // ───────────────────────────────────────────────────────────────────────
      case "refund.created":
      case "refund.processed": {
        const refund = event.payload?.refund?.entity;
        const payment = event.payload?.payment?.entity;
        const notes = refund?.notes || payment?.notes || {};
        const uid = notes.uid;

        console.info(`[payment/webhook] Refund ${refund?.id} of ₹${(refund?.amount || 0) / 100} for uid: ${uid}`);

        if (uid) {
          // Revert subscription back to free
          await db.doc(`users/${uid}`).set(
            {
              subscription: "free",
              subscriptionStatus: "refunded",
              subscriptionUpdatedAt: new Date().toISOString(),
              lastRefund: {
                refundId: refund?.id,
                paymentId: refund?.payment_id,
                amountPaise: refund?.amount,
                refundedAt: new Date().toISOString(),
              },
            },
            { merge: true }
          );

          // Store credit note record
          await db.doc(`users/${uid}/refunds/${refund?.id || Date.now()}`).set({
            refundId: refund?.id,
            paymentId: refund?.payment_id,
            amountPaise: refund?.amount,
            processedAt: new Date().toISOString(),
            status: "processed",
          });
        }

        await eventRef.set({
          eventType,
          uid: uid || null,
          refundId: refund?.id,
          amountPaise: refund?.amount,
          processedAt: new Date().toISOString(),
        });

        return res.status(200).json({ received: true, refunded: true, uid });
      }

      // Default: Acknowledge unrecognized events to prevent Razorpay retries
      default: {
        return res.status(200).json({ received: true, ignored: eventType });
      }
    }
  } catch (err) {
    console.error("[payment/webhook] processing failed", err);
    // 500 tells Razorpay to retry the webhook later
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
