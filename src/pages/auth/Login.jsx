import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, Wallet, Eye, EyeOff, ArrowRight } from "lucide-react";
import { auth } from "../../lib/firebase";
import { signInWithCredential, GoogleAuthProvider } from "firebase/auth";

const Login = () => {
    const { login, loginWithGoogle, loginAsDemoUser } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        window.handleElectronDeepLink = async (url) => {
            try {
                const urlObj = new URL(url);
                const idToken = urlObj.searchParams.get('idToken');
                if (idToken) {
                    setGoogleLoading(true);
                    const credential = GoogleAuthProvider.credential(idToken);
                    await signInWithCredential(auth, credential);
                    navigate("/dashboard");
                }
            } catch (err) {
                console.error("Deep link auth error:", err);
                setError("Failed to authenticate from desktop browser.");
                setGoogleLoading(false);
            }
        };
    }, [navigate]);

    async function handleGoogleLogin() {
        if (window.isElectronApp) {
            window.open(window.location.origin + '/?electronAuthFlow=true#/login', '_blank');
            return;
        }
        try {
            setError("");
            setGoogleLoading(true);
            const res = await loginWithGoogle();
            const params = new URLSearchParams(window.location.search);
            if (params.get('electronAuthFlow') === 'true') {
                const credential = GoogleAuthProvider.credentialFromResult(res);
                if (credential?.idToken) {
                    window.location.href = `budget-tracker://auth?idToken=${credential.idToken}`;
                    return;
                }
            }
            navigate("/dashboard");
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to sign in with Google.");
        }
        setGoogleLoading(false);
    }

    async function handleEmailLogin(e) {
        e.preventDefault();
        try {
            setError("");
            setLoading(true);
            await login(email, password);
            navigate("/dashboard");
        } catch (err) {
            console.error(err);
            setError("Failed to sign in. Please check your credentials.");
        }
        setLoading(false);
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background p-4">

            {/* Animated background blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/15 rounded-full blur-3xl animate-float" />
                <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
                <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-indigo-500/8 rounded-full blur-3xl animate-float" style={{ animationDelay: '0.8s' }} />
            </div>

            {/* Card */}
            <div className="relative w-full max-w-md animate-up">
                <div className="glass-strong rounded-3xl p-7 sm:p-8 space-y-6">

                    {/* Header */}
                    <div className="text-center space-y-3">
                        <div className="flex justify-center mb-4">
                            <div className="p-3 bg-gradient-to-br from-primary to-purple-600 rounded-2xl shadow-xl shadow-primary/30">
                                <Wallet className="w-7 h-7 text-white" />
                            </div>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                            Welcome back
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Sign in to your <span className="text-gradient font-semibold">BudgetTracker</span> account
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm p-3.5 rounded-xl flex items-center gap-2.5 border border-destructive/20 animate-enter">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Google Sign In */}
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={googleLoading}
                        className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-border bg-background/60 hover:bg-muted/60 hover:border-primary/30 font-medium text-sm transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-sm"
                    >
                        {googleLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                        )}
                        Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="relative flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">or</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="input-field"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="input-field pr-11"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 h-11"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>Sign In <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>

                    {/* Demo Mode */}
                    <button
                        type="button"
                        onClick={() => { loginAsDemoUser(); navigate("/dashboard"); }}
                        className="w-full h-10 rounded-xl border border-dashed border-border/80 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted/40 transition-all duration-200 font-medium"
                    >
                        ✨ Try Demo Mode — No signup required
                    </button>

                    {/* Sign up link */}
                    <p className="text-center text-sm text-muted-foreground">
                        Don't have an account?{" "}
                        <Link to="/signup" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                            Create account →
                        </Link>
                    </p>
                </div>

                {/* Footer links */}
                <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground/70">
                    <Link to="/terms"   className="hover:text-primary transition-colors">Terms</Link>
                    <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
                    <Link to="/refund"  className="hover:text-primary transition-colors">Refund</Link>
                    <Link to="/contact" className="hover:text-primary transition-colors">Contact</Link>
                </div>
            </div>
        </div>
    );
};

export default Login;
