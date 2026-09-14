import crypto from "crypto";

const ACTIVE_KEY_ID = "rzp_live_TbaEqXiggkCFdn";
const ACTIVE_KEY_SECRET = "lskN2g7hFhZTyzE5jff5hwaR";

export function getRazorpayCredentials() {
  const envId = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "").trim();
  const envSecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();

  // If env var has the old deactivated key or empty, fallback to the confirmed active keys
  if (envId && envId !== "rzp_live_SxnMdRoFHmdcg8" && envSecret && envSecret !== "[REDACTED_SECRET]") {
    return { keyId: envId, keySecret: envSecret };
  }
  return { keyId: ACTIVE_KEY_ID, keySecret: ACTIVE_KEY_SECRET };
}

export function getRazorpayKeyId() {
  return getRazorpayCredentials().keyId;
}

export async function createRazorpayOrder({ amount, currency = "INR", receipt, notes = {} }) {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      receipt,
      notes,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data?.error?.description || data?.error?.message || "Razorpay order creation failed";
    const err = new Error(errorMsg);
    err.details = data;
    err.statusCode = response.status;
    throw err;
  }

  return data;
}

export async function fetchRazorpayOrder(orderId) {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: {
      "Authorization": authHeader,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data?.error?.description || data?.error?.message || "Could not fetch Razorpay order";
    const err = new Error(errorMsg);
    err.details = data;
    throw err;
  }

  return data;
}

export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const { keySecret } = getRazorpayCredentials();
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Backwards compatibility for any callers expecting getRazorpayClient()
export function getRazorpayClient() {
  return {
    orders: {
      create: (params) => createRazorpayOrder(params),
      fetch: (orderId) => fetchRazorpayOrder(orderId),
    },
  };
}
