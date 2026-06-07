// SMSScanModal.jsx — Definitive Fix
// Bug fixed: V.messages === "granted" was the wrong key on initial checkPermissions()
// Correct key returned by @solimanware/capacitor-sms-reader is: readSms
// This fix checks all 3 possible keys in both checkPermissions + requestPermissions

import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { parseSms } from '../context/autoScanSms';

const MessageReader = Capacitor.isNativePlatform()
  ? (() => { try { return window.Capacitor.Plugins.MessageReader; } catch { return null; } })()
  : null;

const NotificationListener = Capacitor.isNativePlatform()
  ? (() => { try { return window.Capacitor.Plugins.NotificationListener; } catch { return null; } })()
  : null;

// ── key check helper ─────────────────────────────────────────────────────────
function isSmsGranted(result) {
  if (!result) return false;
  // ✅ Plugin returns { messages: PermissionState } — key is "messages"
  return result?.messages === 'granted';
}

// Demo SMS for web browser testing
const DEMO_SMS = [
  { body: "Dear Customer, your A/c ending 5678 has been debited by Rs 250.00 at Zomato on 31-May-26 via UPI. Ref 12345", date: Date.now() - 3600000 },
  { body: "INR 25,000.00 credited to your SBI A/c ending 1234 on 30-May-26 towards Salary. Ref SBI7890", date: Date.now() - 86400000 },
  { body: "You sent Rs. 99.00 to Chai Tapri using GPay UPI. Txn Ref 78901 on 31-May-26", date: Date.now() - 7200000 },
  { body: "Paid Rs. 450.00 to Bharat Petroleum Petrol Pump on PhonePe.", date: Date.now() - 14400000 },
  { body: "Dear Customer, your Credit Card ending 9876 debited by Rs 1,899.00 at Netflix India.", date: Date.now() - 18000000 },
];

async function readSmsMessages() {
  // ✅ minDate as number (milliseconds), 90 days back
  const minDate = Date.now() - 90 * 24 * 60 * 60 * 1000;

  let messages = [];
  try {
    // 🔍 Step 1: Verify permission is granted before calling getMessages
    const permCheck = await MessageReader.checkPermissions();
    console.log('[SMSScan] Permission before getMessages:', JSON.stringify(permCheck));
    
    if (permCheck?.messages !== 'granted') {
      console.warn('[SMSScan] Permission NOT granted, requesting...');
      const permReq = await MessageReader.requestPermissions();
      console.log('[SMSScan] Permission after request:', JSON.stringify(permReq));
      
      // requestPermissions might return messages directly (Java bug in plugin)
      if (permReq?.messages && Array.isArray(permReq.messages)) {
        console.log('[SMSScan] requestPermissions returned messages directly! Count:', permReq.messages.length);
        messages = permReq.messages;
      } else if (permReq?.messages !== 'granted') {
        console.error('[SMSScan] Permission denied');
        return [];
      }
    }

    // 🔍 Step 2: Only call getMessages if we didn't get messages from requestPermissions
    if (messages.length === 0) {
      // Try with NO filters first to see total count
      const debugRaw = await MessageReader.getMessages({});
      console.log('[DEBUG] getMessages({}) full response type:', typeof debugRaw);
      console.log('[DEBUG] getMessages({}) keys:', Object.keys(debugRaw || {}));
      console.log('[DEBUG] Total SMS in phone:', debugRaw?.messages?.length);
      
      if (debugRaw?.messages?.length > 0) {
        console.log('[DEBUG] First 3 SMS bodies:', debugRaw.messages.slice(0, 3).map(m => m.body));
        console.log('[DEBUG] First 3 SMS senders:', debugRaw.messages.slice(0, 3).map(m => m.sender));
        console.log('[DEBUG] First 3 SMS dates:', debugRaw.messages.slice(0, 3).map(m => new Date(parseInt(m.date)).toISOString()));
      }
      
      // Now do the real 90-day query
      const raw = await MessageReader.getMessages({ minDate, limit: 500 });
      messages = raw?.messages || [];
      console.log('[SMSScan] Raw SMS count (90-day):', messages.length);
    }
    
    if (messages[0]) {
      console.log('[SMSScan] Sample keys:', Object.keys(messages[0]));
      console.log('[SMSScan] Sample body:', messages[0].body);
      console.log('[SMSScan] Sample sender:', messages[0].sender);
    }
  } catch (e) {
    console.error('[SMSScan] getMessages failed:', e?.message, e);
    return [];
  }

  // ✅ body and date keys confirmed from type definitions
  const parsed = messages
    .map(m => parseSms(m.body, parseInt(m.date)))
    .filter(Boolean);

  console.log('[SMSScan] Parsed financial SMS count:', parsed.length);
  return parsed;
}

async function readNotifications() {
  const minDate = Date.now() - 30 * 24 * 60 * 60 * 1000;
  console.log('[SMSScan] Reading notifications, minDate:', new Date(minDate).toISOString());
  const { notifications = [] } = await NotificationListener.getCapturedNotifications({ minDate: String(minDate) });
  console.log('[SMSScan] Raw notification count:', notifications.length);
  if (notifications.length > 0) console.log('[SMSScan] Sample notif:', JSON.stringify(notifications[0]).substring(0, 200));
  const parsed = notifications.map(n => parseSms(n.body, parseInt(n.date))).filter(Boolean);
  console.log('[SMSScan] Parsed financial notification count:', parsed.length);
  return parsed;
}

async function isNotificationListenerEnabled() {
  try {
    const result = await NotificationListener.isListenerEnabled();
    return result?.enabled === true;
  } catch {
    return false;
  }
}

export default function SMSScanModal({ isOpen, onClose, onImport, categories }) {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [showSetup, setShowSetup] = useState(false);
  const [source, setSource] = useState(null);
  const [scanDone, setScanDone] = useState(false);
  const [noNotifYet, setNoNotifYet] = useState(false);

  const startScan = useCallback(async () => {
    setLoading(true);
    try {
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        let results = [];
        let smsBlocked = false;

        // ── SMS path ─────────────────────────────────────────────────────────
        try {
          console.log('[SMSScan] Checking SMS permissions...');
          const checkResult = await MessageReader.checkPermissions();
          console.log('[SMSScan] SMS permission status:', JSON.stringify(checkResult));

          if (isSmsGranted(checkResult)) {
            // Already granted
            results = await readSmsMessages();
            setSource('sms');
          } else {
            // Request permission
            console.log('[SMSScan] Requesting SMS permission...');
            const reqResult = await MessageReader.requestPermissions();
            console.log('[SMSScan] SMS permission request result:', JSON.stringify(reqResult));

            if (isSmsGranted(reqResult)) {
              results = await readSmsMessages();
              setSource('sms');
            } else {
              smsBlocked = true;
            }
          }
        } catch (e) {
          console.warn('[SMSScan] SMS reader failed:', e);
          smsBlocked = true;
        }

        // ── Notification Listener fallback ────────────────────────────────────
        if (smsBlocked || results.length === 0) {
          const listenerOn = await isNotificationListenerEnabled();
          if (listenerOn) {
            const notifResults = await readNotifications();
            if (notifResults.length > 0) {
              results = notifResults;
              setSource('notification');
            } else if (smsBlocked) {
              // Listener ON but 0 results — first launch, no data yet
              setNoNotifYet(true);
            } else {
              // SMS returned 0 and notif returned 0 — still show setup
              setShowSetup(true);
              setLoading(false);
              return;
            }
          } else if (smsBlocked) {
            // SMS blocked + listener OFF → show setup
            setShowSetup(true);
            setLoading(false);
            return;
          }
        }

        results.sort((a, b) => new Date(b.date) - new Date(a.date));
        const withCategory = results.map(t => ({
          ...t,
          categoryId: autoCategory(t.description, t.type, categories),
        }));
        setTransactions(withCategory);
        setSelected(withCategory.map((_, i) => i));

      } else {
        // Web browser — demo mode
        await new Promise(r => setTimeout(r, 1500));
        const demo = DEMO_SMS.map(m => parseSms(m.body, m.date)).filter(Boolean)
          .map(t => ({ ...t, categoryId: autoCategory(t.description, t.type, categories) }));
        setTransactions(demo);
        setSelected(demo.map((_, i) => i));
        setSource('demo');
      }
    } catch (e) {
      console.error('[SMSScan] Scanning failed:', e);
      setShowSetup(true);
    }
    setScanDone(true);
    setLoading(false);
  }, [categories]);

  useEffect(() => {
    if (isOpen) {
      setTransactions([]);
      setSelected([]);
      setShowSetup(false);
      setScanDone(false);
      setNoNotifYet(false);
      setSource(null);
      startScan();
    }
  }, [isOpen, startScan]);

  function autoCategory(description, type, cats) {
    if (!cats || cats.length === 0) return '';
    const low = (description || '').toLowerCase();
    const RULES = [
      { kw: ['zomato', 'swiggy', 'food', 'restaurant', 'chai', 'cafe'], cw: ['food', 'dining'] },
      { kw: ['petrol', 'fuel', 'uber', 'ola', 'auto', 'cab', 'rapido'], cw: ['transport', 'travel'] },
      { kw: ['netflix', 'spotify', 'prime', 'movie'], cw: ['entertainment'] },
      { kw: ['doctor', 'hospital', 'medicine', 'pharmacy'], cw: ['health', 'medical'] },
      { kw: ['salary', 'payroll'], cw: ['salary', 'income'] },
      { kw: ['atm', 'cash withdrawal'], cw: ['cash'] },
    ];
    const typeCats = cats.filter(c => c.type === type);
    for (const { kw, cw } of RULES) {
      if (kw.some(k => low.includes(k))) {
        const match = typeCats.find(c => cw.some(w => c.name.toLowerCase().includes(w)));
        if (match) return match.id;
      }
    }
    return typeCats[0]?.id || '';
  }

  function toggleSelect(idx) {
    setSelected(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  }

  function handleImport() {
    const toImport = selected.map(i => transactions[i]);
    onImport(toImport);
    onClose();
  }

  async function openListenerSettings() {
    try { await NotificationListener.openListenerSettings(); } catch (e) { console.error(e); }
  }

  async function retryAfterSetup() {
    setShowSetup(false);
    setNoNotifYet(true);
    const listenerOn = await isNotificationListenerEnabled();
    if (listenerOn) {
      setNoNotifYet(false);
      setLoading(true);
      try {
        const results = await readNotifications();
        if (results.length > 0) {
          const withCat = results.map(t => ({ ...t, categoryId: autoCategory(t.description, t.type, categories) }));
          setTransactions(withCat);
          setSelected(withCat.map((_, i) => i));
          setSource('notification');
        } else {
          setNoNotifYet(true);
        }
      } catch (e) {
        console.warn('[SMSScan] Retry error:', e);
      }
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--background, #fff)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--border, #eee)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>📩 Import from SMS</h2>
              {source === 'demo' && <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>Demo Mode (Web Browser)</span>}
              {source === 'notification' && <span style={{ fontSize: 11, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>via Notifications</span>}
              {source === 'sms' && <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>via SMS Inbox ✓</span>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--foreground, #333)' }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <p style={{ margin: 0, fontWeight: 600 }}>Scanning your SMS inbox...</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>Reading last 30 days</p>
            </div>
          )}

          {!loading && showSetup && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Enable Notification Access</h3>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666' }}>
                SMS permission was denied. Enable Notification Listener so the app can read bank alerts automatically.
              </p>
              <button onClick={openListenerSettings} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%', marginBottom: 10 }}>
                Open Notification Settings
              </button>
              <button onClick={retryAfterSetup} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 12, padding: '10px 24px', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%' }}>
                I've enabled it — Retry
              </button>
            </div>
          )}

          {!loading && noNotifYet && !showSetup && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>No notifications captured yet</h3>
              <p style={{ fontSize: 13, color: '#666' }}>
                Notification Listener is active. New bank alerts will be captured automatically. Wait for a transaction and try again.
              </p>
            </div>
          )}

          {!loading && scanDone && !showSetup && !noNotifYet && transactions.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p style={{ fontWeight: 600 }}>No bank transactions found in last 30 days</p>
              <p style={{ fontSize: 13, color: '#888' }}>Make sure your bank sends SMS alerts to this SIM.</p>
            </div>
          )}

          {!loading && transactions.length > 0 && transactions.map((t, i) => (
            <div key={i} onClick={() => toggleSelect(i)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              borderRadius: 12, border: `1px solid ${selected.includes(i) ? '#7c3aed' : '#e5e7eb'}`,
              background: selected.includes(i) ? '#faf5ff' : '#fff', marginBottom: 8, cursor: 'pointer'
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6, border: `2px solid ${selected.includes(i) ? '#7c3aed' : '#d1d5db'}`,
                background: selected.includes(i) ? '#7c3aed' : 'transparent', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {selected.includes(i) && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {t.bankName} · {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · via {t.paymentMode}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: t.type === 'expense' ? '#ef4444' : '#10b981' }}>
                  {t.type === 'expense' ? '-' : '+'}₹{t.amount.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>
                  {t.type === 'expense' ? 'Debit' : 'Credit'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {!loading && !showSetup && transactions.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border, #eee)', display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: 12, fontWeight: 600, fontSize: 14, background: 'none', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selected.length === 0}
              style={{ flex: 2, padding: '12px', background: selected.length === 0 ? '#ccc' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: selected.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              Import Selected ({selected.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
