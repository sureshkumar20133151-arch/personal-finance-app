import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFinanceData } from "../../hooks/useFinanceData";
import { Loader2, Users, AlertCircle, ArrowRight, CheckCircle2, Shield, Wallet } from "lucide-react";

const JoinHousehold = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { currentUser, loginWithGoogle } = useAuth();
    const { joinHousehold, householdId, profile } = useFinanceData();

    const codeParam = searchParams.get("code") || searchParams.get("invite") || "";
    const [code, setCode] = useState(codeParam.toUpperCase());
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState("");
    const [joined, setJoined] = useState(false);

    React.useEffect(() => {
        if (codeParam) {
            const formatted = codeParam.toUpperCase().trim();
            setCode(formatted);
            localStorage.setItem("pending_household_code", formatted);
        }
    }, [codeParam]);

    async function handleJoinNow(e) {
        if (e) e.preventDefault();
        if (!code.trim()) {
            setError("Please enter a valid 6-digit invite code.");
            return;
        }
        setError("");
        setLoading(true);
        try {
            await joinHousehold(code.trim());
            localStorage.removeItem("pending_household_code");
            setJoined(true);
            setTimeout(() => {
                navigate("/dashboard");
            }, 1500);
        } catch (err) {
            console.error(err);
            setError(err.message || "Could not join household. Please check the code and try again.");
        }
        setLoading(false);
    }

    async function handleGoogleJoin() {
        if (code.trim()) {
            localStorage.setItem("pending_household_code", code.trim());
        }
        setError("");
        setGoogleLoading(true);
        try {
            await loginWithGoogle();
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to sign in with Google.");
        }
        setGoogleLoading(false);
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background p-4 sm:p-6">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/15 rounded-full blur-3xl animate-float" />
                <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.2s' }} />
            </div>

            <div className="relative w-full max-w-md animate-up">
                <div className="glass-strong rounded-3xl p-7 sm:p-8 space-y-6 text-center">
                    <div className="flex justify-center">
                        <div className="p-3.5 bg-gradient-to-br from-primary to-purple-600 rounded-2xl shadow-xl shadow-primary/30">
                            <Users className="w-8 h-8 text-white" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Join Household</h1>
                        <p className="text-sm text-muted-foreground">
                            You've been invited to share transactions & track household expenses together!
                        </p>
                    </div>

                    {code && (
                        <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 space-y-1">
                            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Invite Code</span>
                            <span className="text-2xl font-black font-mono tracking-widest text-primary">{code}</span>
                        </div>
                    )}

                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm p-3.5 rounded-xl flex items-center gap-2.5 border border-destructive/20 text-left">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {joined ? (
                        <div className="bg-emerald-500/10 text-emerald-500 p-4 rounded-2xl flex items-center justify-center gap-2.5 border border-emerald-500/20 font-bold">
                            <CheckCircle2 className="w-5 h-5" />
                            <span>Successfully Joined Household! Redirecting...</span>
                        </div>
                    ) : currentUser ? (
                        <div className="space-y-4">
                            <div className="text-xs text-muted-foreground p-3 rounded-xl bg-muted/50 border border-border">
                                Signed in as <strong className="text-foreground">{currentUser.displayName || currentUser.email}</strong>
                            </div>

                            {householdId ? (
                                <div className="space-y-3">
                                    <p className="text-xs text-amber-500 font-semibold">
                                        You are already in a household. You must leave your current household before joining another.
                                    </p>
                                    <button
                                        onClick={() => navigate("/account")}
                                        className="btn-primary w-full h-11 text-sm font-bold"
                                    >
                                        Go to Account &amp; Household Settings
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleJoinNow}
                                    disabled={loading || !code}
                                    className="btn-primary w-full flex items-center justify-center gap-2 h-12 text-sm font-bold shadow-xl shadow-primary/20"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Join Household Now</span><ArrowRight className="w-4 h-4" /></>}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={handleGoogleJoin}
                                disabled={googleLoading}
                                className="w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-card border border-border hover:bg-muted font-bold text-sm transition-all shadow-sm"
                            >
                                {googleLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                        </svg>
                                        <span>Sign In with Google to Join</span>
                                    </>
                                )}
                            </button>

                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground font-semibold">Or use email</span></div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Link
                                    to={`/signup?code=${encodeURIComponent(code)}`}
                                    className="py-2.5 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                                >
                                    Sign Up
                                </Link>
                                <Link
                                    to={`/login?code=${encodeURIComponent(code)}`}
                                    className="py-2.5 px-4 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                                >
                                    Log In
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JoinHousehold;
