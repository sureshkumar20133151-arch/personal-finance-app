
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFinanceData } from '../hooks/useFinanceData';
import { User, LogOut, CreditCard, Shield, CheckCircle2, Loader2, Camera, Edit2, Check, X, Crown, Tag, AlertCircle, Sparkles, Users, UserPlus, Copy, Trash2, Eye, EyeOff, LogOut as LeaveIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Capacitor } from '@capacitor/core';
import { Checkout } from 'capacitor-razorpay';
import AvatarFallback from '../components/AvatarFallback';
import { AVATAR_PRESETS, renderAvatarDataUrl } from '../lib/avatars';
import { apiUrl } from '../lib/apiBase';

const Account = () => {
    const { currentUser, logout, updateUserProfile } = useAuth();
    const { subscription, isPro, trialEndDate, updateSubscription, clearData, deleteAccount } = useFinanceData();
    const navigate = useNavigate();
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState('');
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);

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

    const handleChooseAvatar = (presetId) => {
        setShowAvatarPicker(false);
        setPhotoLoading(true);
        const dataUrl = renderAvatarDataUrl(presetId, 150);
        updateUserProfile(null, dataUrl)
            .catch((err) => {
                console.error(err);
                alert("Failed to update profile picture.");
            })
            .finally(() => {
                setPhotoLoading(false);
            });
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

    // Calls our backend (api/payment/create-order.js) which creates the Razorpay
    // order server-side. Requires the caller's Firebase ID token so the backend
    // knows which uid this order belongs to.
    const createOrderOnServer = async (planType) => {
        const idToken = await currentUser.getIdToken();
        const res = await fetch(apiUrl('/api/payment/create-order'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ planType }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || 'Could not create order');
        }
        return res.json();
    };

    // Calls our backend (api/payment/verify.js) which checks the Razorpay
    // signature and, only if valid, writes the subscription to Firestore.
    // The client never sets its own subscription field for paid plans anymore.
    const verifyPaymentOnServer = async (payload) => {
        const idToken = await currentUser.getIdToken();
        const res = await fetch(apiUrl('/api/payment/verify'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || 'Payment verification failed');
        }
        return res.json();
    };

    const handleUpgrade = async (planType) => {
        setCheckoutLoading(true);

        let order;
        try {
            order = await createOrderOnServer(planType);
        } catch (err) {
            console.error('create-order failed:', err);
            alert('Could not start checkout. Please try again.');
            setCheckoutLoading(false);
            return;
        }

        const options = {
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            order_id: order.orderId,
            name: 'BudgetTracker Pro',
            description: `Upgrade to ${order.planName}`,
            image: 'https://cdn.pixabay.com/photo/2017/09/07/08/54/money-2724241_1280.png',
            prefill: {
                email: currentUser?.email || '',
                contact: ''
            },
            notes: {
                userId: currentUser?.uid || '',
                planType: planType
            },
            theme: {
                color: '#4f46e5' 
            }
        };

        const finishVerification = async (response) => {
            try {
                await verifyPaymentOnServer({
                    razorpay_order_id: response.razorpay_order_id || order.orderId,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    planType,
                });
                // No client-side write here on purpose: the backend already wrote
                // `subscription` via the Admin SDK, and the app has a live
                // onSnapshot listener on this user's doc, so the UI updates
                // automatically once Firestore reflects the server's write.
                alert('Payment successful! Your plan has been upgraded.');
            } catch (err) {
                console.error('Payment verification failed:', err);
                alert('Payment received but verification failed. Please contact support with your payment ID: ' + (response.razorpay_payment_id || 'unknown'));
            }
        };

        if (Capacitor.isNativePlatform()) {
            try {
                const data = await Checkout.open(options);
                const response = data.response || data;
                await finishVerification(response);
            } catch (error) {
                console.error('Razorpay native failed:', error);
                alert(`Payment was cancelled or failed.`);
            }
            setCheckoutLoading(false);
            return;
        }

        const scriptLoaded = await loadRazorpayScript();

        if (!scriptLoaded) {
            alert('Razorpay Checkout SDK failed to load. Please check your internet connection.');
            setCheckoutLoading(false);
            return;
        }

        options.handler = async function (response) {
            if (razorpayOpenRef.current) {
                razorpayOpenRef.current = false;
                if (window.history.state?.razorpayOpen) {
                    window.history.back();
                }
            }
            await finishVerification(response);
        };

        options.modal = {
            ondismiss: function () {
                if (razorpayOpenRef.current) {
                    razorpayOpenRef.current = false;
                    if (window.history.state?.razorpayOpen) {
                        window.history.back();
                    }
                }
                setCheckoutLoading(false);
            }
        };

        try {
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

    const remainingTrialDays = trialEndDate ? Math.ceil((new Date(trialEndDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

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
                                    <AvatarFallback />
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

                            {/* Choose-a-preset-avatar trigger */}
                            <button
                                type="button"
                                onClick={() => setShowAvatarPicker((v) => !v)}
                                disabled={photoLoading}
                                className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Choose Avatar
                            </button>
                        </div>

                        {showAvatarPicker && (
                            <div className="w-full grid grid-cols-6 gap-2.5 -mt-2 sm:mt-0 sm:ml-2">
                                {AVATAR_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => handleChooseAvatar(preset.id)}
                                        title={preset.id}
                                        className="w-11 h-11 rounded-full flex items-center justify-center text-xl border-2 border-transparent hover:border-primary transition-colors"
                                        style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
                                    >
                                        {preset.emoji}
                                    </button>
                                ))}
                            </div>
                        )}

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
                                    subscription === 'trial' ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/10 text-amber-500 border border-amber-400/30 shadow-sm shadow-amber-400/5">
                                            <Crown className="w-3 h-3" /> Pro Trial ({remainingTrialDays} days left)
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/10 text-amber-500 border border-amber-400/30 shadow-sm shadow-amber-400/5">
                                            <Crown className="w-3 h-3" /> Pro ({subscription === 'yearly' ? 'Yearly' : 'Monthly'})
                                        </span>
                                    )
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
                    <h2 className="text-xl font-bold mb-1">Subscription Plans</h2>
                    <p className="text-sm text-muted-foreground mb-5">All features included in Starter. Only SMS auto-scan is a future Pro add-on.</p>
                    <div className="grid md:grid-cols-2 gap-6">

                        {/* Starter Plan */}
                        <div className={cn("p-6 rounded-2xl border transition-all relative flex flex-col justify-between", isPro ? "border-primary ring-1 ring-primary/20 bg-primary/5" : "border-border bg-card shadow-sm")}>
                            <div>
                                {isPro && (
                                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                                        {subscription === 'trial' ? '✨ TRIAL ACTIVE' : '✅ ACTIVE'}
                                    </div>
                                )}
                                <h3 className="text-2xl font-bold text-foreground mb-2">Starter Plan</h3>
                                <div className="flex flex-col gap-1 mb-2 pb-4 border-b border-border">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-black text-foreground">₹9</span>
                                        <span className="text-sm font-medium text-muted-foreground">/ month</span>
                                    </div>
                                    {subscription === 'trial' && trialEndDate && (
                                        <div className="text-xs text-amber-500 font-semibold mt-1">
                                            🎉 Free Trial active — {remainingTrialDays} days remaining. Subscribe to continue after trial.
                                        </div>
                                    )}
                                    {subscription !== 'trial' && !isPro && (
                                        <div className="text-xs text-primary font-semibold mt-1">
                                            Start with a free 90-day trial — no credit card required!
                                        </div>
                                    )}
                                </div>
                                <ul className="space-y-2.5 mb-6 mt-4">
                                    <li className="flex items-center gap-3 text-sm text-foreground"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> Manual Transaction Entry</li>
                                    <li className="flex items-center gap-3 text-sm text-foreground"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> Multiple Bank Accounts & Cash Wallet</li>
                                    <li className="flex items-center gap-3 text-sm text-foreground"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> Bank Statement PDF & CSV Import</li>
                                    <li className="flex items-center gap-3 text-sm text-foreground"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> CSV / Excel Data Export</li>
                                    <li className="flex items-center gap-3 text-sm text-foreground"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> Advanced Charts & Monthly Trends</li>
                                    <li className="flex items-center gap-3 text-sm text-foreground"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> Category Budgets & Limit Alerts</li>
                                    <li className="flex items-center gap-3 text-sm text-foreground"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> Loans & Debts EMI Tracker</li>
                                    <li className="flex items-center gap-3 text-sm text-foreground"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> Real-time Cloud Sync (Firebase)</li>
                                    <li className="flex items-center gap-2 text-sm text-muted-foreground/50"><X className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" /> <span>SMS Auto-scan <span className="text-xs italic">(Pro add-on — coming soon)</span></span></li>
                                </ul>
                            </div>
                            <div className="space-y-2">
                                {isPro && subscription !== 'trial' ? (
                                    <>
                                        <div className="text-center py-2.5 px-6 rounded-xl bg-muted text-muted-foreground font-bold border border-border text-sm">
                                            ✅ Starter Plan Active
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (confirm("Are you sure you want to cancel? You will lose access to all features.")) {
                                                    updateSubscription('free');
                                                }
                                            }}
                                            className="block w-full mt-1 py-2 px-6 text-center rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 font-bold transition-colors text-xs"
                                        >
                                            Cancel Subscription
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => handleUpgrade('starter')}
                                        disabled={checkoutLoading}
                                        className="block w-full py-3 px-6 text-center rounded-xl font-bold transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm text-sm"
                                    >
                                        {checkoutLoading ? (
                                            <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />Processing...</span>
                                        ) : subscription === 'trial' ? (
                                            "Subscribe Now — ₹9 / month"
                                        ) : (
                                            "Start Free 90-Day Trial"
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Coupon Code Redemption */}
                        <CouponCard />

                        {/* SMS Pro Add-on — Coming Soon */}
                        <div className="relative p-6 rounded-2xl border border-dashed border-border bg-muted/30 flex flex-col justify-between opacity-75">
                            <div className="absolute top-0 right-0 bg-amber-400/20 text-amber-600 dark:text-amber-400 text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl border border-amber-400/30">
                                🚧 COMING SOON
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Crown className="w-5 h-5 text-amber-500" />
                                    <h3 className="text-2xl font-bold text-foreground">SMS Pro Add-on</h3>
                                </div>
                                <div className="flex items-baseline gap-2 mb-4 pb-4 border-b border-border">
                                    <span className="text-2xl font-black text-muted-foreground">₹TBD</span>
                                    <span className="text-sm text-muted-foreground">/ month</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-4 italic">
                                    Automatic bank SMS scanning is currently under development and will be available as a future add-on.
                                </p>
                                <ul className="space-y-2.5 mb-6">
                                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" /> Auto SMS Transaction Scan</li>
                                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" /> Real-time UPI Push Notifications</li>
                                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" /> ATM Auto Cash Routing</li>
                                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" /> Zero-touch Background Import</li>
                                </ul>
                            </div>
                            <button disabled className="block w-full py-3 px-6 text-center rounded-xl font-bold bg-muted text-muted-foreground cursor-not-allowed border border-border text-sm">
                                🔔 Notify Me When Available
                            </button>
                        </div>

                    </div>
                </div>

                <HouseholdCard />

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
                <div className="rounded-2xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-6 shadow-sm md:col-span-2 space-y-4">
                    <h3 className="font-semibold text-red-600">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage account deletion or reset data. Deleting your account moves your data to temporary backup. If you sign up again with the same email, you can choose to restore your data or start fresh.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => {
                                if (confirm("Are you sure you want to reset all transaction data? This cannot be undone.")) {
                                    clearData();
                                }
                            }}
                            className="bg-red-600/10 text-red-600 border border-red-600/20 hover:bg-red-600/20 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
                        >
                            Reset All Data
                        </button>

                        <button
                            onClick={() => {
                                if (confirm("Are you sure you want to DELETE your account?\n\nYour data will be soft-deleted. If you log back in later with the same email, you can restore your data or start fresh.")) {
                                    deleteAccount();
                                }
                            }}
                            className="bg-red-600 text-white hover:bg-red-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Household (Team Sharing) ──────────────────────────────────────────────
const SEAT_LIMIT_LABELS = { free: 1, trial: 4, starter: 4, monthly: 4, yearly: 4, lifetime: 4, sms_pro: 4 };

const HouseholdCard = () => {
    const {
        householdId, householdMeta, householdMemberBalances, householdTotalBalance,
        createHousehold, joinHousehold, leaveHousehold, removeHouseholdMember,
        regenerateInviteCode, toggleBalancePrivacy, profile, formatMoney, subscription,
    } = useFinanceData();
    const { currentUser } = useAuth();

    const [mode, setMode] = useState('choose'); // 'choose' | 'create' | 'join'
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [inviteCode, setInviteCode] = useState(null);
    const [copied, setCopied] = useState(false);

    const isOwner = householdMeta?.ownerId === currentUser?.uid;
    const seatLimit = SEAT_LIMIT_LABELS[subscription] || 1;

    async function handleCreate(e) {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const res = await createHousehold(name.trim());
            setInviteCode(res.inviteCode);
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    }

    async function handleJoin(e) {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            await joinHousehold(code.trim());
            setMode('choose');
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    }

    async function handleGetInviteCode() {
        setLoading(true); setError('');
        try {
            const res = await regenerateInviteCode();
            setInviteCode(res.inviteCode);
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    }

    async function handleLeave() {
        if (!confirm(isOwner
            ? "Owners can't leave while other members remain. Remove all other members first if you want to leave."
            : "Leave this household? You'll go back to your own private data.")) return;
        setLoading(true); setError('');
        try {
            await leaveHousehold();
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    }

    async function handleRemove(uid) {
        if (!confirm("Remove this member from the household?")) return;
        setLoading(true); setError('');
        try {
            await removeHouseholdMember(uid);
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    }

    function copyCode() {
        if (!inviteCode) return;
        navigator.clipboard?.writeText(inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    // ── Not in a household yet ──────────────────────────────────────────────
    if (!householdId) {
        return (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:col-span-2">
                <div className="flex items-center gap-4 mb-4">
                    <Users className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Household (Team Sharing)</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    Share transactions, categories, budget & loans with family members — each person keeps their own balance private or visible, your choice.
                </p>

                {error && (
                    <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                    </div>
                )}

                {mode === 'choose' && (
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={() => setMode('create')} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
                            <UserPlus className="w-4 h-4" /> Create Household
                        </button>
                        <button onClick={() => setMode('join')} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-border font-semibold text-sm">
                            <Users className="w-4 h-4" /> Join with Code
                        </button>
                    </div>
                )}

                {mode === 'create' && !inviteCode && (
                    <form onSubmit={handleCreate} className="space-y-3">
                        <input
                            type="text" value={name} onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Kumar Family" required
                            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm"
                        />
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setMode('choose')} className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold">Back</button>
                            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                            </button>
                        </div>
                    </form>
                )}

                {mode === 'create' && inviteCode && (
                    <div className="text-center space-y-3">
                        <p className="text-sm text-muted-foreground">Household created! Share this code with family members:</p>
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-2xl font-black tracking-widest bg-muted px-4 py-2 rounded-xl">{inviteCode}</span>
                            <button onClick={copyCode} className="p-2.5 rounded-xl border border-border"><Copy className="w-4 h-4" /></button>
                        </div>
                        {copied && <p className="text-xs text-green-600">Copied!</p>}
                        <button onClick={() => { setMode('choose'); setInviteCode(null); }} className="text-sm font-semibold text-primary">Done</button>
                    </div>
                )}

                {mode === 'join' && (
                    <form onSubmit={handleJoin} className="space-y-3">
                        <input
                            type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="E.G. AB12CD" required maxLength={6}
                            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm tracking-widest uppercase"
                        />
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setMode('choose')} className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold">Back</button>
                            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        );
    }

    // ── Already in a household ──────────────────────────────────────────────
    return (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:col-span-2">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <Users className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">{householdMeta?.name || 'My Household'}</h3>
                </div>
                <span className="text-xs text-muted-foreground">{householdMemberBalances.length} / {seatLimit} members</span>
            </div>

            {error && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-3">{error}</div>
            )}

            <div className="mb-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Household Total</p>
                <p className="text-2xl font-black">{formatMoney(householdTotalBalance)}</p>
            </div>

            <div className="space-y-2.5 mb-4">
                {householdMemberBalances.map((m) => (
                    <div key={m.uid} className="flex items-center justify-between p-3 rounded-xl border border-border">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-border">
                                {m.photoURL ? <img src={m.photoURL} alt={m.name} className="w-full h-full object-cover" /> : <AvatarFallback />}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{m.name}{m.isMe && ' (You)'}</p>
                                <p className="text-xs text-muted-foreground">
                                    {m.hideBalance && !m.isMe ? 'Balance hidden' : formatMoney(m.balance)}
                                </p>
                            </div>
                        </div>
                        {isOwner && !m.isMe && (
                            <button onClick={() => handleRemove(m.uid)} disabled={loading} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg flex-shrink-0">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <button
                onClick={toggleBalancePrivacy}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-border mb-4 text-sm"
            >
                <span className="flex items-center gap-2">
                    {profile?.hideBalanceFromHousehold ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    Hide my balance from household
                </span>
                <span className={cn("w-10 h-6 rounded-full relative transition-colors flex-shrink-0", profile?.hideBalanceFromHousehold ? "bg-primary" : "bg-muted")}>
                    <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform", profile?.hideBalanceFromHousehold ? "translate-x-4" : "translate-x-0.5")} />
                </span>
            </button>

            <div className="flex gap-3">
                {isOwner && (
                    <button onClick={handleGetInviteCode} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold flex items-center justify-center gap-2">
                        <UserPlus className="w-4 h-4" /> Invite Member
                    </button>
                )}
                <button onClick={handleLeave} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-red-200 dark:border-red-900/30 text-red-600 text-sm font-semibold flex items-center justify-center gap-2">
                    <LeaveIcon className="w-4 h-4" /> Leave Household
                </button>
            </div>

            {inviteCode && (
                <div className="mt-4 text-center space-y-2 p-4 rounded-xl bg-muted">
                    <p className="text-xs text-muted-foreground">New invite code (old one stopped working):</p>
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-xl font-black tracking-widest">{inviteCode}</span>
                        <button onClick={copyCode} className="p-2 rounded-lg border border-border"><Copy className="w-4 h-4" /></button>
                    </div>
                    {copied && <p className="text-xs text-green-600">Copied!</p>}
                </div>
            )}
        </div>
    );
};

// ─── Coupon Code Redemption ────────────────────────────────────────────────
const CouponCard = () => {
    const { redeemCoupon, couponsRedeemed = [] } = useFinanceData();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message }

    async function handleRedeem(e) {
        e.preventDefault();
        if (!code.trim()) return;
        setLoading(true);
        setFeedback(null);
        const result = await redeemCoupon(code);
        if (result.success) {
            setFeedback({ type: 'success', message: `🎉 Coupon applied! +${result.bonusDays} days added to your trial.` });
            setCode('');
        } else {
            setFeedback({ type: 'error', message: result.message || 'Invalid coupon code.' });
        }
        setLoading(false);
    }

    return (
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 mb-1">
                <Tag className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Have a Coupon Code?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Redeem a promo code to extend your trial.</p>

            <form onSubmit={handleRedeem} className="flex gap-2">
                <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SOLODEVLOPER100"
                    className="input-field flex-1 uppercase"
                    disabled={loading}
                />
                <button
                    type="submit"
                    disabled={loading || !code.trim()}
                    className="px-5 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm text-sm shrink-0"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </button>
            </form>

            {feedback && (
                <div className={cn(
                    "mt-3 text-sm flex items-center gap-2 p-2.5 rounded-xl border",
                    feedback.type === 'success'
                        ? "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20"
                        : "text-destructive bg-destructive/10 border-destructive/20"
                )}>
                    {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{feedback.message}</span>
                </div>
            )}

            {couponsRedeemed.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                    Redeemed: {couponsRedeemed.join(', ')}
                </p>
            )}
        </div>
    );
};

export default Account;
