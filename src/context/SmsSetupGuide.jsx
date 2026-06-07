// ─────────────────────────────────────────────────────────────────────────────
//  SmsSetupGuide.jsx
//
//  Shown as a bottom sheet / modal when notification listener is not enabled.
//  Your existing SMSScan modal already has this — this is a cleaner standalone.
//
//  Usage:
//    import SmsSetupGuide from "./SmsSetupGuide";
//    <SmsSetupGuide isOpen={showSetup} onClose={() => setShowSetup(false)} />
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { registerPlugin } from "@capacitor/core";

const NotificationListener = registerPlugin("NotificationListener");

const STEPS = [
  { num: "1", text: 'Tap "Open Settings" below' },
  { num: "2", text: 'Find "Budget Tracker" in the list' },
  { num: "3", text: "Toggle ON to allow notifications" },
  { num: "4", text: 'Come back and tap "I\'ve Enabled It"' },
];

export default function SmsSetupGuide({ isOpen, onClose, onDone }) {
  if (!isOpen) return null;

  const openSettings = async () => {
    try { await NotificationListener.openListenerSettings(); }
    catch (e) { console.error("Cannot open settings:", e); }
  };

  const checkAndContinue = async () => {
    try {
      const result = await NotificationListener.isListenerEnabled();
      if (result?.enabled) {
        onDone?.();
        onClose();
      } else {
        alert("Not enabled yet. Please go to Settings and enable Notification Access for Budget Tracker.");
      }
    } catch {
      alert("Could not check. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-3xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔔</span>
          </div>
          <h2 className="text-xl font-bold">Enable SMS Auto-Import</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Allow notification access so your bank transactions load automatically.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map(s => (
            <div key={s.num} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                {s.num}
              </div>
              <p className="text-sm">{s.text}</p>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="space-y-2 pt-2">
          <button
            onClick={openSettings}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            Open Settings
          </button>
          <button
            onClick={checkAndContinue}
            className="w-full py-3 rounded-xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors"
          >
            I've Enabled It ✓
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
