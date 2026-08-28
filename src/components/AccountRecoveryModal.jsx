import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useFinanceData } from "../hooks/useFinanceData";
import { RotateCcw, Trash2, AlertTriangle, Loader2 } from "lucide-react";

const AccountRecoveryModal = () => {
    const { currentUser } = useAuth();
    const { checkDeletedAccount, restoreDeletedAccount, startFreshAccount } = useFinanceData();

    const [deletedData, setDeletedData] = useState(null);
    const [checking, setChecking] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        async function runCheck() {
            if (!currentUser || currentUser.isAnonymous) {
                setChecking(false);
                return;
            }
            try {
                if (checkDeletedAccount) {
                    const data = await checkDeletedAccount(currentUser.uid);
                    if (mounted && data) {
                        setDeletedData(data);
                    }
                }
            } catch (err) {
                console.error("Account recovery check error:", err);
            }
            if (mounted) setChecking(false);
        }
        runCheck();
        return () => { mounted = false; };
    }, [currentUser, checkDeletedAccount]);

    if (checking || !deletedData) return null;

    const formattedDate = deletedData.deletedAt
        ? new Date(deletedData.deletedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
          })
        : "a previous date";

    const handleRestore = async () => {
        setActionLoading(true);
        try {
            await restoreDeletedAccount(currentUser.uid);
        } catch (e) {
            console.error("Failed to restore account data:", e);
            alert("Could not restore data. Please try again.");
        }
        setActionLoading(false);
    };

    const handleStartFresh = async () => {
        setActionLoading(true);
        try {
            await startFreshAccount(currentUser.uid);
            setDeletedData(null);
        } catch (e) {
            console.error("Failed to clear old account data:", e);
            setDeletedData(null);
        }
        setActionLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-enter">
            <div className="glass-strong border border-primary/30 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 text-center shadow-2xl animate-up">
                <div className="flex justify-center">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                        Previous Account Found
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        You deleted an account associated with this email on <span className="font-semibold text-foreground">{formattedDate}</span>.
                    </p>
                </div>

                <div className="bg-muted/40 border border-border rounded-2xl p-4 text-xs text-muted-foreground text-left space-y-1.5">
                    <p className="font-semibold text-foreground text-sm mb-1">What would you like to do?</p>
                    <p>• <strong className="text-primary">Restore Data:</strong> Recover all your transactions, categories, budgets, and settings.</p>
                    <p>• <strong className="text-destructive">Start Fresh:</strong> Permanently wipe your old data and start with a clean account.</p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleRestore}
                        disabled={actionLoading}
                        className="btn-primary w-full flex items-center justify-center gap-2 h-12 text-sm font-bold shadow-lg shadow-primary/20"
                    >
                        {actionLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <RotateCcw className="w-4 h-4" />
                                <span>Restore Previous Data</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleStartFresh}
                        disabled={actionLoading}
                        className="w-full flex items-center justify-center gap-2 h-11 text-xs font-semibold rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                    >
                        {actionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                <span>Start Fresh (Permanently Wipe Old Data)</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccountRecoveryModal;
