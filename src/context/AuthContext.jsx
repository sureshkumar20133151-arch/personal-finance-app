
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInWithPopup,
    updateProfile,
    signInWithCredential,
    GoogleAuthProvider
} from 'firebase/auth';
import { Wallet } from 'lucide-react';


const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // MOCK LOGIN implementation
    const loginAsDemoUser = () => {
        const demoUser = {
            uid: 'demo-user-123',
            email: 'demo@fintrack.app',
            displayName: 'Demo User',
            isAnonymous: true
        };
        setCurrentUser(demoUser);
        localStorage.setItem('fintrack_demo_user', 'true');
    };

    async function signup(email, password, name) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
            await updateProfile(userCredential.user, { displayName: name });
        }
        return userCredential;
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    async function loginWithGoogle() {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
            if (!clientId || clientId.includes("placeholder")) {
                throw new Error("Google Sign-In is not configured. Please add your actual VITE_GOOGLE_CLIENT_ID to the .env file.");
            }

            const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
            GoogleAuth.initialize({
                clientId: clientId,
                scopes: ['profile', 'email'],
                grantOfflineAccess: true
            });

            const googleUser = await GoogleAuth.signIn();
            const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
            return signInWithCredential(auth, credential);
        } else {
            return signInWithPopup(auth, googleProvider);
        }
    }

    async function updateUserProfile(name, photoURL) {
        if (auth.currentUser) {
            await updateProfile(auth.currentUser, {
                displayName: name || auth.currentUser.displayName,
                photoURL: photoURL || auth.currentUser.photoURL
            });
            // Force state refresh
            setCurrentUser({
                uid: auth.currentUser.uid,
                email: auth.currentUser.email,
                displayName: auth.currentUser.displayName,
                photoURL: auth.currentUser.photoURL,
                isAnonymous: false
            });
        } else if (currentUser && currentUser.isAnonymous) {
            setCurrentUser(prev => ({
                ...prev,
                displayName: name || prev.displayName,
                photoURL: photoURL || prev.photoURL
            }));
        }
    }

    function logout() {
        localStorage.removeItem('fintrack_demo_user');
        setCurrentUser(null);
        return signOut(auth);
    }

    useEffect(() => {
        // Check for persisted demo session
        if (localStorage.getItem('fintrack_demo_user')) {
            setCurrentUser({
                uid: 'demo-user-123',
                email: 'demo@fintrack.app',
                displayName: 'Demo User',
                isAnonymous: true
            });
            setLoading(false);
            return;
        }

        // Try to connect to Firebase, but don't block if it fails (missing keys)
        try {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                setCurrentUser(user);
                setLoading(false);
            });

            // Fallback: Ensure app loads cleanly if network or IndexedDB initialization is slow
            const timer = setTimeout(() => {
                setLoading((currentLoading) => currentLoading ? false : currentLoading);
            }, 1500);

            return () => {
                unsubscribe();
                clearTimeout(timer);
            };
        } catch (error) {
            console.warn("Firebase Auth not configured or failed to initialize. Using Demo mode only.", error);
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
        loginAsDemoUser // Exposed for the Login page
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-6 text-foreground font-sans">
                <div className="flex flex-col items-center gap-5 max-w-sm text-center animate-in fade-in zoom-in-95 duration-500">
                    {/* Pulsing Branded Wallet Icon */}
                    <div className="p-4 bg-gradient-to-br from-[#10b981] via-purple-600 to-indigo-600 rounded-2xl shadow-xl shadow-[#10b981]/20 shrink-0 animate-pulse">
                        <Wallet className="w-8 h-8 text-white" />
                    </div>
                    
                    {/* App Title */}
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-[#10b981] to-purple-400 bg-clip-text text-transparent">
                            BudgetTracker
                        </h1>
                        <p className="text-xs text-gray-400 mt-1.5 font-medium tracking-wide">Initializing secure session...</p>
                    </div>
                    
                    {/* Modern Spinner */}
                    <div className="w-6 h-6 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin mt-2" />
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
