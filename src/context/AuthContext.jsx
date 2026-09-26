
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInWithPopup,
    updateProfile,
    signInWithCredential,
    GoogleAuthProvider,
    getAdditionalUserInfo
} from 'firebase/auth';
import { Wallet } from 'lucide-react';


const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

function createUserProxy(user, customPhoto) {
    if (!user) return null;
    const photo = customPhoto !== undefined ? customPhoto : user.photoURL;
    return new Proxy(user, {
        get(target, prop) {
            if (prop === 'photoURL') return photo;
            const val = target[prop];
            return typeof val === 'function' ? val.bind(target) : val;
        }
    });
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    async function signup(email, password, name, profileData = null) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
            await updateProfile(userCredential.user, { displayName: name });
        }
        // Bootstrap Firestore doc directly via uid — avoids relying on React state
        // (currentUser) which may not have updated yet in this same tick.
        const trialEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        await setDoc(doc(db, "users", userCredential.user.uid), {
            subscription: "trial",
            trialEndDate,
            ...(profileData ? { profile: { ...profileData, profileComplete: true } } : {}),
        }, { merge: true });
        return userCredential;
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    async function bootstrapNewGoogleUser(result) {
        const isNewUser = getAdditionalUserInfo(result)?.isNewUser;
        if (isNewUser) {
            const trialEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
            await setDoc(doc(db, "users", result.user.uid), {
                subscription: "trial",
                trialEndDate,
            }, { merge: true });
        }
        return result;
    }

    async function loginWithGoogle() {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "457615196609-7obkashutlfi5qcu75oo9u23khm4l8o9.apps.googleusercontent.com";

            const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
            GoogleAuth.initialize({
                clientId: clientId,
                scopes: ['profile', 'email'],
                grantOfflineAccess: true
            });

            const googleUser = await GoogleAuth.signIn();
            const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
            const result = await signInWithCredential(auth, credential);
            return bootstrapNewGoogleUser(result);
        } else {
            const result = await signInWithPopup(auth, googleProvider);
            return bootstrapNewGoogleUser(result);
        }
    }

    async function updateUserProfile(name, photoURL) {
        if (auth.currentUser) {
            const updates = {};
            if (name && name !== auth.currentUser.displayName) {
                updates.displayName = name;
            }
            // Only send photoURL to Firebase Auth if it's an external HTTP/HTTPS URL (<= 2048 chars).
            // Firebase Auth strictly rejects data: URIs and long strings with auth/invalid-photo-url.
            const isHttpUrl = typeof photoURL === 'string' && /^https?:\/\//i.test(photoURL) && photoURL.length <= 2048;
            if (isHttpUrl) {
                updates.photoURL = photoURL;
            }

            if (Object.keys(updates).length > 0) {
                try {
                    await updateProfile(auth.currentUser, updates);
                } catch (err) {
                    console.warn("[AuthContext] updateProfile notice:", err);
                }
            }

            // If photoURL is provided (data URL or preset avatar), persist in localStorage and Firestore
            if (photoURL !== undefined && photoURL !== null) {
                try {
                    localStorage.setItem(`custom_photo_${auth.currentUser.uid}`, photoURL);
                } catch (e) {
                    console.warn("[AuthContext] LocalStorage photo cache warning:", e);
                }

                try {
                    await setDoc(doc(db, "users", auth.currentUser.uid), {
                        photoURL,
                        "profile.photoURL": photoURL
                    }, { merge: true });
                } catch (e) {
                    console.error("[AuthContext] Firestore photo save error:", e);
                }
            }

            const activePhoto = photoURL !== undefined && photoURL !== null
                ? photoURL
                : (localStorage.getItem(`custom_photo_${auth.currentUser.uid}`) || auth.currentUser.photoURL);

            setCurrentUser(createUserProxy(auth.currentUser, activePhoto));
        } else if (currentUser && currentUser.isAnonymous) {
            setCurrentUser(prev => ({
                ...prev,
                displayName: name || prev.displayName,
                photoURL: photoURL !== undefined ? photoURL : prev.photoURL
            }));
        }
    }

    function logout() {
        setCurrentUser(null);
        return signOut(auth);
    }

    useEffect(() => {
        // Try to connect to Firebase, but don't block if it fails (missing keys)
        try {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    // Synchronously read local cache for instant render with zero UI flash
                    const cachedPhoto = localStorage.getItem(`custom_photo_${user.uid}`);
                    let activePhoto = cachedPhoto || user.photoURL;

                    setCurrentUser(createUserProxy(user, activePhoto));
                    setLoading(false);

                    // If not in local cache, check Firestore in background to sync from cloud
                    if (!cachedPhoto) {
                        try {
                            const userSnap = await getDoc(doc(db, "users", user.uid));
                            if (userSnap.exists()) {
                                const cloudPhoto = userSnap.data()?.photoURL || userSnap.data()?.profile?.photoURL;
                                if (cloudPhoto) {
                                    try {
                                        localStorage.setItem(`custom_photo_${user.uid}`, cloudPhoto);
                                    } catch {
                                        // Ignore storage quota or access errors in private browsing
                                    }
                                    setCurrentUser(createUserProxy(user, cloudPhoto));
                                }
                            }
                        } catch (e) {
                            console.warn("[AuthContext] Cloud photo lookup notice:", e);
                        }
                    }
                } else {
                    setCurrentUser(null);
                    setLoading(false);
                }
            });

            // Fallback: only kicks in if Firebase genuinely never responds (e.g. a
            // hung network request or a broken IndexedDB store)
            const timer = setTimeout(() => {
                setLoading((currentLoading) => currentLoading ? false : currentLoading);
            }, 8000);

            return () => {
                unsubscribe();
                clearTimeout(timer);
            };
        } catch (error) {
            console.warn("Firebase Auth not configured or failed to initialize.", error);
            setLoading(false);
        }
    }, []);

    const value = {
        currentUser,
        signup,
        login,
        loginWithGoogle,
        logout,
        updateUserProfile,
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground font-sans">
                <div className="flex flex-col items-center gap-4 max-w-sm text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="p-3.5 bg-primary/10 text-primary border border-primary/20 rounded-2xl shadow-sm shrink-0">
                        <Wallet className="w-8 h-8" />
                    </div>
                    
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            BudgetTracker
                        </h1>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Securing your session...</p>
                    </div>
                    
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mt-1" />
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
