
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFinanceData } from '../hooks/useFinanceData';
import { User, LogOut, CreditCard, Shield, CheckCircle2, Loader2, Camera, Edit2, Check, X, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

const Account = () => {
    const { currentUser, logout, updateUserProfile } = useAuth();
    const { subscription, updateSubscription, clearData } = useFinanceData();
    const navigate = useNavigate();
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState('');

    const razorpayOpenRef = useRef(false);
    const razorpayInstanceRef = useRef(null);

    useEffect(() => {
        if (currentUser) {
            setNewName(currentUser.displayName || currentUser.email?.split('@')[0] || '');
        }
    }, [currentUser]);

    // Handle hardware back button via popstate to prevent exiting app/navigating when Razorpay is open
    useEffect(() => {
        const handlePopState = () => {
            if (razorpayOpenRef.current) {
                if (razorpayInstanceRef.current) {
                    try {
                        razorpayInstanceRef.current.close();
                    } catch (e) {
                        console.error('Error closing Razorpay on back button:', e);
                    }
                }
                razorpayOpenRef.current = false;
                setCheckoutLoading(false);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Failed to log out', error);
        }
    };

    const handleSaveName = async () => {
        if (!newName.trim()) return;
        try {
            await updateUserProfile(newName.trim(), null);
            setIsEditingName(false);
        } catch (err) {
            console.error("Failed to update name:", err);
            alert("Failed to update name.");
        }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            alert("File size must be less than 5MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 150;
                const MAX_HEIGHT = 150;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                
                setPhotoLoading(true);
                updateUserProfile(null, dataUrl)
                    .then(() => {
                        alert("Profile picture updated successfully!");
                    })
                    .catch((err) => {
                        console.error(err);
                        alert("Failed to update profile picture.");
                    })
                    .finally(() => {
                        setPhotoLoading(false);
                    });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handleUpgrade = async (plan) => {
        setCheckoutLoading(true);
        const scriptLoaded = await loadRazorpayScript();

        if (!scriptLoaded) {
            alert('Razorpay Checkout SDK failed to load. Please check your internet connection.');
            setCheckoutLoading(false);
            return;
        }

        const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_SqWOpMmySq1KXZ',
            amount: 19900, // Amount is in currency subunits (199 INR = 19900 paise)
            currency: 'INR',
            name: 'BudgetTracker Pro',
            description: `Upgrade to ${plan}`,
            image: 'https://cdn.pixabay.com/photo/2017/09/07/08/54/money-2724241_1280.png',
            handler: function (response) {
                if (razorpayOpenRef.current) {
                    razorpayOpenRef.current = false;
                    if (window.history.state?.razorpayOpen) {
                        window.history.back();
                    }
                }
                alert(`Payment Successful!\nPayment ID: ${response.razorpay_payment_id}`);
                updateSubscription('monthly');
            },
            modal: {
                ondismiss: function () {
                    if (razorpayOpenRef.current) {
                        razorpayOpenRef.current = false;
                        if (window.history.state?.razorpayOpen) {
                            window.history.back();
                        }
                    }
                    setCheckoutLoading(false);
                }
            },
            prefill: {
                email: currentUser?.email || '',
                contact: ''
            },
            notes: {
                userId: currentUser?.uid || ''
            },
            theme: {
                color: '#4f46e5' // Indigo / Primary theme color
            }
        };

        try {
            // Push history state to intercept hardware back button
            window.history.pushState({ razorpayOpen: true }, '');
            razorpayOpenRef.current = true;

            const paymentObject = new window.Razorpay(options);
            razorpayInstanceRef.current = paymentObject;
            paymentObject.open();
        } catch (err) {
            console.error('Razorpay initialization failed:', err);
            alert('Could not initialize payment window.');
            if (razorpayOpenRef.current) {
                razorpayOpenRef.current = false;
                if (window.history.state?.razorpayOpen) {
                    window.history.back();
                }
            }
        }
        setCheckoutLoading(false);
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
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
                        {/* Profile Photo with Upload Trigger and Pro Badge */}
                        <div className="relative group shrink-0">
                            <div className={cn(
                                "w-24 h-24 rounded-full overflow-hidden flex items-center justify-center relative bg-muted border border-border transition-all",
                                isPro ? "ring-4 ring-amber-400 ring-offset-2 dark:ring-offset-card shadow-lg shadow-amber-400/10" : ""
                            )}>
                                {photoLoading ? (
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                ) : currentUser?.photoURL ? (
                                    <img 
                                        src={currentUser.photoURL} 
                                        alt="Profile" 
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-tr from-primary/20 to-purple-500/20 flex items-center justify-center text-primary font-bold text-3xl">
                                        {(currentUser?.displayName || currentUser?.email || 'U')[0].toUpperCase()}
                                    </div>
                                )}

                                {/* Image upload overlay */}
                                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity duration-200 text-xs font-semibold">
                                    <Camera className="w-5 h-5 mb-1" />
                                    <span>Upload</span>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={handlePhotoChange}
                                        disabled={photoLoading}
                                    />
                                </label>
                            </div>

                            {/* Premium Pro Badge overlay */}
                            {isPro && (
                                <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 to-amber-600 text-white rounded-full p-1.5 shadow-md border border-white dark:border-card flex items-center justify-center" title="Pro Member">
                                    <Crown className="w-3.5 h-3.5" />
                                </div>
                            )}
                        </div>

                        {/* User Details */}
                        <div className="flex-1 w-full text-center sm:text-left space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-center sm:justify-start">
                                {isEditingName ? (
                                    <div className="flex items-center gap-2 w-full max-w-xs mx-auto sm:mx-0">
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                            placeholder="Your name"
                                            autoFocus
                                        />
                                        <button 
                                            onClick={handleSaveName}
                                            className="p-2 bg-primary text-white rounded-lg hover:bg-primary/95 transition-colors"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setIsEditingName(false);
                                                setNewName(currentUser?.displayName || currentUser?.email?.split('@')[0] || '');
                                            }}
                                            className="p-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                                        <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-1.5">
                                            {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
                                        </h2>
                                        <button 
                                            onClick={() => setIsEditingName(true)}
                                            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
                                            title="Edit name"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
                            
                            <div className="flex justify-center sm:justify-start pt-1">
                                {isPro ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/10 text-amber-500 border border-amber-400/30 shadow-sm shadow-amber-400/5">
                                        <Crown className="w-3 h-3" /> Pro Subscription
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                                        Free Account
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 border-t border-border/50 pt-4 mt-2">
                        <button
                            onClick={handleLogout}
                            className="bg-destructive/10 text-destructive hover:bg-destructive/20 w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
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
                                <button 
                                    onClick={() => handleUpgrade('Pro Plan (₹199/mo)')} 
                                    disabled={checkoutLoading}
                                    className="block w-full py-2.5 px-6 text-center rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {checkoutLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Initializing...
                                        </span>
                                    ) : (
                                        "Upgrade to Pro"
                                    )}
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
