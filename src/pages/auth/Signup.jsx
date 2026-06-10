import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";

const Signup = () => {
    const { signup, loginWithGoogle, loginAsDemoUser } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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
        try {
            setError("");
            setLoading(true);
            await signup(email, password, name);
            navigate("/dashboard");
        } catch (err) {
            console.error(err);
            setError("Failed to create an account. Please check that your email is valid and your password is at least 6 characters.");
        }
        setLoading(false);
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
            <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-2xl border border-border shadow-lg">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Create an account</h1>
                    <p className="text-muted-foreground">Start managing your finances today</p>
                </div>

                {error && (
                    <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <form onSubmit={handleEmailSignup} className="space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Full Name</label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Suresh Kumar"
                                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Email Address</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="•••••••• (min 6 characters)"
                                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-11 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign Up with Email"}
                        </button>
                    </form>

                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">Or</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleSignup}
                        disabled={googleLoading}
                        className="w-full inline-flex items-center justify-center gap-3 rounded-xl text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-12 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {googleLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                        )}
                        Continue with Google
                    </button>

                    <button
                        type="button"
                        onClick={() => { loginAsDemoUser(); navigate("/dashboard"); }}
                        className="w-full inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11"
                    >
                        Try Demo Mode (No Setup)
                    </button>
                </div>

                <div className="text-center text-sm">
                    <p className="text-muted-foreground">
                        Already have an account?{" "}
                        <Link to="/login" className="font-medium text-primary hover:underline">Log in</Link>
                    </p>
                </div>
            </div>

            {/* Razorpay Verification Links */}
            <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground max-w-sm mx-auto">
                <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
                <span>&bull;</span>
                <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
                <span>&bull;</span>
                <Link to="/refund" className="hover:text-primary transition-colors">Refund</Link>
                <span>&bull;</span>
                <Link to="/shipping" className="hover:text-primary transition-colors">Shipping</Link>
                <span>&bull;</span>
                <Link to="/contact" className="hover:text-primary transition-colors">Contact</Link>
            </div>
        </div>
    );
};

export default Signup;
