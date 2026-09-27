import { requireAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { getRazorpayClient, getRazorpayKeyId, verifyPaymentSignature } from "../_lib/razorpay.js";
import { PLAN_AMOUNTS_PAISE, PLAN_NAMES } from "../_lib/plans.js";
import { applyCors } from "../_lib/cors.js";
import { buildGstInvoice, saveInvoiceToDb } from "../_lib/gstInvoice.js";

// ─── Sub-handlers ────────────────────────────────────────────────────────────

async function handleCreateOrder(req, res, decoded) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
      receipt: `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      notes: { uid: decoded.uid, planType },
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId(),
      planName: PLAN_NAMES[planType],
    });
  } catch (err) {
    console.error("create-order failed", err);
    const msg = err?.error?.description || err?.message || "Could not create payment order";
    return res.status(500).json({ error: msg });
  }
}

async function handleVerify(req, res, decoded) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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

  // 1. Cryptographic signature check
  const signatureValid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!signatureValid) {
    return res.status(400).json({ error: "Payment signature verification failed" });
  }

  // 2. Cross-check order against Razorpay
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

    // 3. Save GST invoice & update user subscription
    let invoiceNumber = null;
    try {
      const db = await adminDb();
      if (db) {
        try {
          const invoiceData = buildGstInvoice({
            uid: decoded.uid,
            userEmail: decoded.email || order.notes?.email || "",
            userName: decoded.name || order.notes?.name || "",
            planType,
            amountPaise: order.amount,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            buyerState: order.notes?.buyerState || "Tamil Nadu",
            buyerGstin: order.notes?.buyerGstin || "",
          });
          invoiceNumber = await saveInvoiceToDb(db, invoiceData);
        } catch (invErr) {
          console.warn("GST Invoice generation in verify warning:", invErr.message);
        }

        await db.doc(`users/${decoded.uid}`).set(
          {
            subscription: planType,
            subscriptionStatus: "active",
            subscriptionUpdatedAt: new Date().toISOString(),
            latestInvoiceNumber: invoiceNumber || null,
          },
          { merge: true }
        );
      }
    } catch (dbErr) {
      console.warn("Firestore Admin DB update warning:", dbErr.message);
    }

    return res.status(200).json({ success: true, subscription: planType, invoiceNumber });
  } catch (err) {
    console.error("payment verify failed", err);
    return res.status(500).json({ error: "Verification failed" });
  }
}

async function handleInvoices(req, res, decoded) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = await adminDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    const snapshot = await db
      .collection(`users/${decoded.uid}/invoices`)
      .orderBy("invoiceDate", "desc")
      .limit(50)
      .get();

    const invoices = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ invoices });
  } catch (err) {
    console.error("Failed to fetch invoices:", err);
    return res.status(500).json({ error: "Could not fetch invoices" });
  }
}

// ─── Main Dispatcher ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const rawAction = req.query?.action || req.url?.split("?")[0].split("/").pop();
  const action = String(rawAction || "").toLowerCase().trim();

  let decoded;
  try {
    decoded = await requireAuth(req);
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message });
  }

  switch (action) {
    case "create-order":
      return handleCreateOrder(req, res, decoded);
    case "verify":
      return handleVerify(req, res, decoded);
    case "invoices":
      return handleInvoices(req, res, decoded);
    default:
      return res.status(404).json({ error: `Unknown payment action: ${action}` });
  }
}
