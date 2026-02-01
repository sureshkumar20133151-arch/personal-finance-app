
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useFinanceData } from '../hooks/useFinanceData';
import { User, LogOut, CreditCard, Shield, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

const Account = () => {
    const { currentUser, logout } = useAuth();
    const { subscription, updateSubscription, clearData } = useFinanceData();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Failed to log out', error);
        }
    };

    const handleUpgrade = (plan) => {
        // Creates a new tab for payment
        // TODO: Replace 'https://rzp.io/l/DEMO' with your actual Razorpay Payment Link
        if (confirm(`Redirect to Razorpay to pay for ${plan} plan?`)) {
            // Example Link format: https://rzp.io/l/your-custom-link-id
            window.open('https://rzp.io/l/DEMO_LINK', '_blank');

            // Note: In a real automated system, you would use Webhooks to update the subscription
            // For now, you can manually update the user in Firebase after you receive payment email.
        }
    };

    const isPro = subscription === 'monthly' || subscription === 'lifetime';

    return (
        <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-500 pb-20">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Account</h1>
                <p className="text-muted-foreground">Manage your profile and subscription.</p>
            </header>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Profile Card */}
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <User className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">User Profile</h2>
                            <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={handleLogout}
                            className="bg-destructive/10 text-destructive hover:bg-destructive/20 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Log Out
                        </button>
                    </div>
                </div>

                {/* Subscription Plans Section */}
                <div className="md:col-span-2">
                    <h2 className="text-xl font-bold mb-4">Subscription Plans</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Free Plan */}
                        <div className={cn("p-6 rounded-2xl border transition-all relative", !isPro ? "border-primary/50 ring-1 ring-primary/20 bg-primary/5" : "border-border bg-card")}>
                            {!isPro && (
                                <div className="absolute top-0 right-0 bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                                    CURRENT PLAN
                                </div>
                            )}
                            <h3 className="text-2xl font-bold text-foreground mb-2">Free Plan</h3>
                            <div className="text-3xl font-black text-foreground mb-6">₹0<span className="text-base font-medium text-muted-foreground">/mo</span></div>
                            <p className="text-muted-foreground mb-6 pb-6 border-b border-border">For individuals getting started.</p>
                            <ul className="space-y-3 mb-8">
                                <li className="flex items-center gap-3 text-sm text-foreground"><CheckCircle2 className="w-5 h-5 text-green-500" /> Basic Income/Expense Tracking</li>
                                <li className="flex items-center gap-3 text-sm text-foreground"><CheckCircle2 className="w-5 h-5 text-green-500" /> Limited Entries (50/mo)</li>
                                <li className="flex items-center gap-3 text-sm text-foreground"><CheckCircle2 className="w-5 h-5 text-green-500" /> Basic Summary</li>
                            </ul>
                            <button disabled={!isPro} className={cn("block w-full py-2.5 px-6 text-center rounded-xl font-bold transition-colors", !isPro ? "bg-muted text-muted-foreground cursor-default" : "border border-border hover:bg-muted")}>
                                {!isPro ? "Current Plan" : "Downgrade to Free"}
                            </button>
                        </div>

                        {/* Pro Plan */}
                        <div className={cn("relative p-6 rounded-2xl border transition-all", isPro ? "border-primary ring-1 ring-primary bg-primary/5" : "border-border bg-card shadow-sm hover:shadow-md")}>
                            {isPro && (
                                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                                    ACTIVE
                                </div>
                            )}
                            <h3 className="text-2xl font-bold text-foreground mb-2">Pro Plan</h3>
                            <div className="text-3xl font-black text-foreground mb-6">₹199<span className="text-base font-medium text-muted-foreground">/mo</span></div>
                            <p className="text-muted-foreground mb-6 pb-6 border-b border-border">For serious savers and businesses.</p>
                            <ul className="space-y-3 mb-8">
                                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary" /> <strong>Unlimited</strong> Entries</li>
                                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary" /> Advanced Reports & Insights</li>
                                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary" /> Priority Email Support</li>
                                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary" /> Export Data</li>
                            </ul>
                            {isPro ? (
                                <button onClick={() => updateSubscription('free')} className="block w-full py-2.5 px-6 text-center rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 font-bold transition-colors">
                                    Cancel Subscription
                                </button>
                            ) : (
                                <button onClick={() => handleUpgrade('Pro Plan (₹199/mo)')} className="block w-full py-2.5 px-6 text-center rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
                                    Upgrade to Pro
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:col-span-2">
                    <div className="flex items-center gap-4 mb-4">
                        <Shield className="w-5 h-5 text-green-500" />
                        <h3 className="font-semibold">Security & Data</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                        Your data is encrypted and securely stored on Google Firebase.
                    </p>
                    <div className="grid sm:grid-cols-3 gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Cloud Backup</div>
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Secure Login</div>
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 24/7 Access</div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="rounded-2xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-6 shadow-sm md:col-span-2">
                    <h3 className="font-semibold text-red-600 mb-2">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Permanently delete all your transaction data and start fresh. This cannot be undone.
                    </p>
                    <button
                        onClick={() => {
                            if (confirm("Are you sure you want to delete ALL data? This cannot be undone.")) {
                                clearData();
                            }
                        }}
                        className="bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                        Reset All Data
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Account;
