import React, { useState, useRef, useEffect } from "react";
import { Bell, AlertTriangle, AlertCircle, Calendar, Clock, CreditCard, Check, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { triggerHapticSelection } from "../lib/haptics";

export default function NotificationCenter({ alerts = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("dismissed_alerts") || "[]");
    } catch {
      return [];
    }
  });
  const popoverRef = useRef(null);
  const navigate = useNavigate();

  // Filter out temporarily dismissed alerts
  const visibleAlerts = alerts.filter((a) => !dismissedIds.includes(a.id));
  const unreadCount = visibleAlerts.length;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const dismissAlert = (id, e) => {
    e.stopPropagation();
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      sessionStorage.setItem("dismissed_alerts", JSON.stringify(updated));
    } catch {
      // Ignored
    }
  };

  const handleAlertClick = (alert) => {
    triggerHapticSelection();
    setIsOpen(false);
    if (alert.actionUrl) {
      navigate(alert.actionUrl);
    }
  };

  const requestBrowserPermission = async () => {
    if (typeof Notification !== "undefined" && Notification.requestPermission) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          new Notification("BudgetTracker Notifications Enabled", {
            body: "You will now receive timely alerts for upcoming bills and budget warnings.",
            icon: "/app-icon-512.png",
          });
        }
      } catch {
        // Ignored
      }
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => {
          triggerHapticSelection();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer",
          isOpen && "bg-muted text-foreground"
        )}
        title="Notifications & Reminders"
        aria-label="Notifications & Reminders"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white animate-in zoom-in-75">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Reminders & Alerts</h3>
            </div>
            {unreadCount > 0 && (
              <span className="text-[11px] font-semibold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
                {unreadCount} active
              </span>
            )}
          </div>

          {/* Web Notification Permission Prompt */}
          {typeof Notification !== "undefined" && Notification.permission === "default" && (
            <div className="bg-primary/5 border-b border-primary/10 px-4 py-2 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Enable desktop notifications?</span>
              <button
                onClick={requestBrowserPermission}
                className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
              >
                Allow
              </button>
            </div>
          )}

          {/* Alerts List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border/40">
            {visibleAlerts.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2">
                  <Check className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-foreground">All caught up!</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  No upcoming due dates or budget limits exceeded.
                </p>
              </div>
            ) : (
              visibleAlerts.map((alert) => {
                const isCritical = alert.urgency === "critical";
                const isHigh = alert.urgency === "high";

                return (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className={cn(
                      "p-3.5 hover:bg-muted/50 transition-colors cursor-pointer flex items-start gap-3 group",
                      isCritical && "bg-rose-500/5",
                      isHigh && "bg-amber-500/5"
                    )}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-xl shrink-0 mt-0.5",
                        isCritical
                          ? "bg-rose-500/10 text-rose-500"
                          : isHigh
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-blue-500/10 text-blue-500"
                      )}
                    >
                      {alert.category === "loan" && <CreditCard className="w-4 h-4" />}
                      {alert.category === "deferred" && <Clock className="w-4 h-4" />}
                      {alert.category === "recurring" && <Calendar className="w-4 h-4" />}
                      {alert.category === "budget" && <AlertTriangle className="w-4 h-4" />}
                      {alert.category === "balance" && <AlertCircle className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-foreground truncate">{alert.title}</p>
                        <button
                          onClick={(e) => dismissAlert(alert.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground hover:text-foreground px-1 transition-opacity"
                          title="Dismiss"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                        {alert.message}
                      </p>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 self-center group-hover:translate-x-0.5 transition-transform" />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
