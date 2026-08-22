import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, Wallet, Eye, EyeOff, ArrowRight, CheckCircle2, Gift } from "lucide-react";

const perks = [
  "6-month free trial — no credit card",
  "All features unlocked from day one",
  "Real-time cloud sync across devices",
  "100% private & secure data",
];

const professionOptions = ["Business", "Working Professional", "Freelancer", "Student"];

const Signup = () => {
    const { signup, loginWithGoogle, loginAsDemoUser } = useAuth();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [age, setAge] = useState("");
    const [place, setPlace] = useState("");
    const [mobile, setMobile] = useState("");
    const [profession, setProfession] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const navigate = useNavigate();

    async function handleGoogleSignup() {
        try {
            setError("");
            setGoogleLoading(true);
            await loginWithGoogle();
            navigate("/dashboard");
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to sign up with Google. Please try again.");
        }
        setGoogleLoading(false);
    }

    async function handleEmailSignup(e) {
        e.preventDefault();
        if (!profession) {
            setError("Please select your profession.");
            return;
        }
        try {
            setError("");
            setLoading(true);
            const fullName = `${firstName} ${lastName}`.trim();
            await signup(email, password, fullName, {
                firstName,
                lastName,
                age: age ? Number(age) : null,
                place,
                mobile,
                profession,
            });
            navigate("/dashboard");
        } catch (err) {
            console.error(err);
            setError("Failed to create account. Email must be valid and password at least 6 characters.");
        }
        setLoading(false);
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background p-4">

            {/* Animated blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/15 rounded-full blur-3xl animate-float" />
                <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.2s' }} />
                <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-emerald-500/8 rounded-full blur-3xl animate-float" style={{ animationDelay: '0.6s' }} />
            </div>

            <div className="relative w-full max-w-lg animate-up">
                <div className="glass-strong rounded-3xl p-7 sm:p-8 space-y-5">

                    {/* Header */}
                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-3">
                            <div className="p-3 bg-gradient-to-br from-primary to-purple-600 rounded-2xl shadow-xl shadow-primary/30">
                                <Wallet className="w-7 h-7 text-white" />
                            </div>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Create account</h1>
                        <p className="text-sm text-muted-foreground">
                            Join <span className="text-gradient font-semibold">BudgetTracker</span> — free for 6 months
                        </p>
                    </div>

                    {/* Trial perks */}
                    <div className="bg-gradient-to-r from-primary/8 to-purple-500/8 border border-primary/15 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2.5">
                            <Gift className="w-4 h-4 text-primary" />
                            <span className="text-xs font-bold text-primary uppercase tracking-wider">Free 6-Month Trial</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {perks.map((perk, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                    <span>{perk}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm p-3.5 rounded-xl flex items-center gap-2.5 border border-destructive/20 animate-enter">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Google */}
                    <button
                        type="button"
                        onClick={handleGoogleSignup}
                        disabled={googleLoading}
                        className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-border bg-background/60 hover:bg-muted/60 hover:border-primary/30 font-medium text-sm transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-sm"
                    >
                        {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                        )}
                        Sign up with Google
                    </button>

                    {/* Divider */}
                    <div className="relative flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">or</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleEmailSignup} className="space-y-3.5">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label htmlFor="firstName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">First Name</label>
                                <input id="firstName" type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                                    placeholder="Suresh" className="input-field" required />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="lastName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Last Name</label>
                                <input id="lastName" type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                                    placeholder="Kumar" className="input-field" required />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label htmlFor="age" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Age</label>
                                <input id="age" type="number" min="13" max="120" value={age} onChange={e => setAge(e.target.value)}
                                    placeholder="28" className="input-field" required />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="place" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Place</label>
                                <input id="place" type="text" value={place} onChange={e => setPlace(e.target.value)}
                                    placeholder="Madurai" className="input-field" required />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="mobile" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Mobile Number</label>
                            <input id="mobile" type="tel" value={mobile} onChange={e => setMobile(e.target.value)}
                                placeholder="9876543210" className="input-field" required />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Profession</label>
                            <div className="grid grid-cols-2 gap-2">
                                {professionOptions.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setProfession(p)}
                                        className={
                                            "h-10 rounded-xl text-xs font-semibold border transition-colors " +
                                            (profession === p
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border text-muted-foreground hover:bg-muted/60")
                                        }
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Email Address</label>
                            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com" className="input-field" required />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Password</label>
                            <div className="relative">
                                <input id="password" type={showPassword ? "text" : "password"} value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Min 6 characters" className="input-field pr-11" required />
                                <button type="button" onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <button type="submit" disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 h-11">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>}
                        </button>
                    </form>

                    {/* Demo */}
                    <button type="button" onClick={() => { loginAsDemoUser(); navigate("/dashboard"); }}
                        className="w-full h-10 rounded-xl border border-dashed border-border/80 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted/40 transition-all duration-200 font-medium">
                        ✨ Try Demo — No signup required
                    </button>

                    <p className="text-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link to="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">Sign in →</Link>
                    </p>
                </div>

                <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground/70">
                    <Link to="/terms"    className="hover:text-primary transition-colors">Terms</Link>
                    <Link to="/privacy"  className="hover:text-primary transition-colors">Privacy</Link>
                    <Link to="/refund"   className="hover:text-primary transition-colors">Refund</Link>
                    <Link to="/contact"  className="hover:text-primary transition-colors">Contact</Link>
                </div>
            </div>
        </div>
    );
};

export default Signup;
