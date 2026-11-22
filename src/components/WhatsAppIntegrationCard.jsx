import { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Mic, 
  Camera, 
  CheckCircle2, 
  RefreshCw, 
  Unlink, 
  QrCode, 
  Sparkles, 
  ShieldCheck,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BOT_SERVICE_URL = import.meta.env.VITE_WHATSAPP_BOT_URL || 'http://localhost:10000';

export default function WhatsAppIntegrationCard() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [status, setStatus] = useState('loading'); // 'loading' | 'disconnected' | 'qr_ready' | 'connected' | 'reconnecting'
  const [qrCode, setQrCode] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  const pollIntervalRef = useRef(null);

  // Poll status when modal is open or when reconnecting
  const checkStatus = async () => {
    if (!uid) return;
    try {
      const res = await fetch(`${BOT_SERVICE_URL}/api/whatsapp/status?uid=${encodeURIComponent(uid)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        setStatus(data.status);
        if (data.qr) setQrCode(data.qr);
        if (data.phone) setPhoneNumber(data.phone);

        if (data.status === 'connected') {
          setShowQrModal(false);
          setQrCode(null);
          clearInterval(pollIntervalRef.current);
        }
      }
    } catch (err) {
      // Server may be offline locally
      console.warn('[WhatsApp Card] Status check failed:', err.message);
      if (status === 'loading') {
        setStatus('disconnected');
      }
    }
  };

  useEffect(() => {
    checkStatus();
    return () => clearInterval(pollIntervalRef.current);
  }, [uid]);

  const handleStartConnect = async () => {
    if (!uid) return;
    setIsStarting(true);
    setErrorMsg(null);
    setShowQrModal(true);

    try {
      const res = await fetch(`${BOT_SERVICE_URL}/api/whatsapp/start?uid=${encodeURIComponent(uid)}`);
      const data = await res.json();

      if (data.success) {
        setStatus(data.status);
        if (data.qr) setQrCode(data.qr);
        if (data.phone) setPhoneNumber(data.phone);

        // Start polling every 2.5s for scan completion
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(checkStatus, 2500);
      } else {
        throw new Error(data.error || 'Failed to start session');
      }
    } catch (err) {
      setErrorMsg(`Connection error: ${err.message}. Ensure WhatsApp Bot engine is running.`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your WhatsApp assistant?')) return;
    try {
      await fetch(`${BOT_SERVICE_URL}/api/whatsapp/disconnect?uid=${encodeURIComponent(uid)}`, { method: 'POST' });
      setStatus('disconnected');
      setPhoneNumber(null);
      setQrCode(null);
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm md:col-span-2 mt-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
                WhatsApp AI Voice & Bill Tracker
              </h2>
              {status === 'connected' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                  100% Private (Self-Chat)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Log daily expenses instantly via WhatsApp Voice Notes, Google Pay Screenshots, or Receipts directly into your personal account.
            </p>
          </div>
        </div>
      </div>

      {/* Status & Action Block */}
      {status === 'connected' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  Connected as WhatsApp: {phoneNumber ? `+${phoneNumber}` : 'Linked Device'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Your WhatsApp is securely linked to this account only.
                </p>
              </div>
            </div>

            <button
              onClick={handleDisconnect}
              className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>

          {/* Quick Guide on how to use */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs space-y-2">
            <p className="font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              How to track expenses right now:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-muted-foreground">
              <div className="p-2.5 rounded-lg bg-background border border-border flex items-start gap-2">
                <Mic className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">Voice Note:</span>
                  <p className="text-[11px] mt-0.5">Send a 1-sec audio: <em>"Tea ₹20 cash"</em> or <em>"Petrol 500 GPay"</em>.</p>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-background border border-border flex items-start gap-2">
                <Camera className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">Payment Screenshot:</span>
                  <p className="text-[11px] mt-0.5">Share any GPay / PhonePe / Paytm payment screen.</p>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-background border border-border flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">Complete Privacy:</span>
                  <p className="text-[11px] mt-0.5">Send messages to <strong>"You" (Message Yourself)</strong> in your WhatsApp.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-500" />
              Connect your personal WhatsApp in 5 seconds
            </h3>
            <p className="text-xs text-muted-foreground max-w-xl">
              Scan a simple QR code from your phone's WhatsApp. Everything runs privately on your own WhatsApp "Message Yourself" chat. No third party ever sees your expenses.
            </p>
          </div>

          <button
            onClick={handleStartConnect}
            disabled={isStarting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isStarting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
            <span>{isStarting ? 'Generating QR...' : 'Connect WhatsApp (Scan QR)'}</span>
          </button>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold">
                  <QrCode className="w-4 h-4" />
                </div>
                <h3 className="text-base font-extrabold text-foreground">Link WhatsApp Tracker</h3>
              </div>
              <button
                onClick={() => { setShowQrModal(false); clearInterval(pollIntervalRef.current); }}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {errorMsg ? (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            ) : qrCode ? (
              <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-inner border border-border">
                <img src={qrCode} alt="WhatsApp QR Code" className="w-56 h-56 object-contain" />
                <p className="text-[11px] text-gray-500 font-medium mt-2 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                  Waiting for you to scan...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-xs text-muted-foreground font-medium">Generating unique WhatsApp QR Code...</p>
              </div>
            )}

            {/* Steps */}
            <div className="space-y-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/50">
              <p className="font-semibold text-foreground">How to link:</p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                <li>Open <strong>WhatsApp</strong> on your phone</li>
                <li>Tap <strong>Settings</strong> (iOS) or <strong>Three Dots</strong> (Android)</li>
                <li>Tap <strong>Linked Devices</strong> ➔ <strong>Link a Device</strong></li>
                <li>Point your phone camera to scan the QR code above</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
