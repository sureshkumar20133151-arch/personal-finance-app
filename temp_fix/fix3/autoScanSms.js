// ─────────────────────────────────────────────────────────────────────────────
//  autoScanSms.js  — FINAL FIX
//
//  ROOT CAUSES FOUND FROM APK DECOMPILE:
//
//  BUG 1 (MAIN): Permission key is "readSms" not "messages"
//    checkPermissions() returns: { readSms: "granted" | "denied" }
//    But code was checking: r?.messages === "granted"  ← always false!
//    Result: permission dialog popped every time, SMS never read
//
//  BUG 2: Notification listener BANK_PACKAGES list missing Indian Bank app
//    "com.indianbank.mpassbook" not in the list
//    If you use Indian Bank → notifications never captured
//
//  BUG 3: BANK_PACKAGES filter — listener only captures from specific apps
//    If your SMS app package is not in list → bank SMS notifications missed
// ─────────────────────────────────────────────────────────────────────────────

import { registerPlugin } from "@capacitor/core";
import { parseSms } from "./smsParser";

const MessageReader        = registerPlugin("MessageReader");
const NotificationListener = registerPlugin("NotificationListener");

const SCAN_DAYS = 30;

function isDuplicate(existing = [], tx) {
  return existing.some(
    (e) =>
      e.date          === tx.date &&
      Math.abs(e.amount - tx.amount) < 0.01 &&
      e.type          === tx.type &&
      e.bankName      === tx.bankName &&
      e.accountEnding === tx.accountEnding
  );
}

export function autoCategory(description, type, categories = []) {
  const d       = (description || "").toLowerCase();
  const income  = categories.filter((c) => c.type === "income");
  const expense = categories.filter((c) => c.type === "expense");
  const firstExpense = expense[0]?.id || "";
  const firstIncome  = income[0]?.id  || "";

  if (type === "income") {
    if (d.includes("salary")) {
      const cat = income.find((c) => c.name.toLowerCase().includes("salary"));
      return cat ? cat.id : firstIncome;
    }
    const biz = income.find(
      (c) =>
        c.name.toLowerCase().includes("freelance") ||
        c.name.toLowerCase().includes("business")
    );
    return biz ? biz.id : firstIncome;
  }

  const map = [
    { kw: ["zomato","swiggy","food","restaurant","chai","cafe","hotel"],  cw: ["food","dining","coffee"]  },
    { kw: ["petrol","fuel","uber","ola","travel","auto","cab","rapido"],   cw: ["transport","travel","fuel"]},
    { kw: ["netflix","spotify","prime","movie","cinema","hotstar"],        cw: ["entertainment","sub"]     },
    { kw: ["electricity","recharge","water","broadband","wifi","ebill"],   cw: ["utilities","bill"]        },
    { kw: ["amazon","flipkart","shop","myntra","meesho"],                  cw: ["shopping","clothes"]      },
    { kw: ["doctor","hospital","medicine","pharmacy","clinic"],            cw: ["health","medical"]        },
  ];
  for (const { kw, cw } of map) {
    if (kw.some((k) => d.includes(k))) {
      const cat = expense.find((c) => cw.some((w) => c.name.toLowerCase().includes(w)));
      if (cat) return cat.id;
    }
  }
  return firstExpense;
}

// ─── Check permission — handles BOTH "readSms" and "messages" key names ──────
async function isSmsPermissionGranted() {
  try {
    const status = await MessageReader.checkPermissions();
    console.log("[AutoScan] checkPermissions result:", JSON.stringify(status));
    // ✅ FIX 1: plugin returns "readSms" key, not "messages"
    return (
      status?.readSms   === "granted" ||
      status?.messages  === "granted" ||
      status?.READ_SMS  === "granted"
    );
  } catch (e) {
    console.warn("[AutoScan] checkPermissions failed:", e);
    return false;
  }
}

// ─── Request permission ───────────────────────────────────────────────────────
async function requestSmsPermission() {
  try {
    const result = await MessageReader.requestPermissions();
    console.log("[AutoScan] requestPermissions result:", JSON.stringify(result));
    // ✅ FIX 1: check both key names
    return (
      result?.readSms   === "granted" ||
      result?.messages  === "granted" ||
      result?.READ_SMS  === "granted"
    );
  } catch (e) {
    console.warn("[AutoScan] requestPermissions failed:", e);
    return false;
  }
}

// ─── Read SMS inbox ───────────────────────────────────────────────────────────
async function readSms() {
  const minDate = Date.now() - SCAN_DAYS * 24 * 60 * 60 * 1000;
  try {
    const { messages = [] } = await MessageReader.getMessages({ minDate, limit: 200 });
    console.log("[AutoScan] Raw SMS count:", messages.length);
    const parsed = messages
      .map((m) => parseSms(m.body, parseInt(m.date)))
      .filter(Boolean);
    console.log("[AutoScan] Parsed financial SMS:", parsed.length);
    return parsed;
  } catch (e) {
    console.error("[AutoScan] getMessages failed:", e);
    return [];
  }
}

// ─── Read captured notifications ─────────────────────────────────────────────
async function readNotifications() {
  const minDate = Date.now() - SCAN_DAYS * 24 * 60 * 60 * 1000;
  try {
    const { notifications = [] } = await NotificationListener.getCapturedNotifications({
      minDate: String(minDate),
    });
    console.log("[AutoScan] Raw notification count:", notifications.length);
    const parsed = notifications
      .map((n) => parseSms(n.body, parseInt(n.date)))
      .filter(Boolean);
    console.log("[AutoScan] Parsed financial notifications:", parsed.length);
    return parsed;
  } catch (e) {
    console.warn("[AutoScan] getCapturedNotifications failed:", e);
    return [];
  }
}

// ─── Main auto-scan ───────────────────────────────────────────────────────────
export async function autoScanTransactions(existingTransactions = []) {
  if (!window.Capacitor?.isNativePlatform()) {
    return { newTransactions: [], needsSetup: false };
  }

  const parsed    = [];
  let smsBlocked  = false;

  // ── SMS path ────────────────────────────────────────────────────────────
  try {
    let granted = await isSmsPermissionGranted();

    if (!granted) {
      console.log("[AutoScan] SMS not granted — requesting...");
      granted = await requestSmsPermission();
    }

    if (granted) {
      const msgs = await readSms();
      msgs.forEach((tx) => parsed.push(tx));
      console.log("[AutoScan] SMS path total:", parsed.length);
    } else {
      smsBlocked = true;
      console.log("[AutoScan] SMS permission denied after request");
    }
  } catch (e) {
    console.warn("[AutoScan] SMS path error:", e);
    smsBlocked = true;
  }

  // ── Notification Listener path (fallback or supplement) ─────────────────
  try {
    const status = await NotificationListener.isListenerEnabled();
    console.log("[AutoScan] Notification listener enabled:", status?.enabled);

    if (status?.enabled) {
      const notifs = await readNotifications();
      notifs.forEach((tx) => parsed.push(tx));

      if (notifs.length === 0 && smsBlocked) {
        // Listener on but no notifications yet — normal on fresh setup
        console.log("[AutoScan] Listener enabled, no notifications yet");
        return { newTransactions: [], needsSetup: false };
      }
    } else if (smsBlocked) {
      // Both paths unavailable — show setup guide
      return { newTransactions: [], needsSetup: true };
    }
  } catch (e) {
    console.warn("[AutoScan] Notification listener error:", e);
    if (smsBlocked && parsed.length === 0) {
      return { newTransactions: [], needsSetup: true };
    }
  }

  if (parsed.length === 0) {
    return { newTransactions: [], needsSetup: false };
  }

  const newTxs = parsed.filter((tx) => !isDuplicate(existingTransactions, tx));
  console.log(`[AutoScan] ${parsed.length} parsed, ${newTxs.length} new unique`);
  return { newTransactions: newTxs, needsSetup: false };
}

export async function rescanTransactions(existingTransactions = []) {
  const { newTransactions } = await autoScanTransactions(existingTransactions);
  return newTransactions;
}
