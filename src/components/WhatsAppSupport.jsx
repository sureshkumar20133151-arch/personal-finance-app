import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

export default function WhatsAppSupport() {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Phone number configured via env or default placeholder (919999999999)
  const whatsappNumber = import.meta.env.VITE_SUPPORT_WHATSAPP || "919876543210";
  const defaultMessage = encodeURIComponent("Hi BudgetTracker Support, I need help with my account/subscription.");
  const waUrl = `https://wa.me/${whatsappNumber}?text=${defaultMessage}`;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 group">
      {/* Tooltip banner (shown initially until dismissed) */}
      {!dismissed && (
        <div className="hidden sm:flex items-center gap-2 bg-card text-card-foreground border border-border shadow-xl rounded-full pl-4 pr-2 py-1.5 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span>Need help? Chat with us on WhatsApp</span>
          <button 
            onClick={() => setDismissed(true)} 
            className="p-1 hover:bg-muted rounded-full text-muted-foreground transition-colors"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Floating Action Button */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-13 h-13 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/25 transition-all duration-300 hover:scale-105 active:scale-95"
        title="Chat on WhatsApp"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="w-7 h-7 fill-white/20" />
      </a>
    </div>
  );
}
