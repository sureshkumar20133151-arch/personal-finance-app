
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

            // Fallback: If Firebase doesn't respond within 8 seconds (e.g. invalid config), force load.
            setTimeout(() => {
                setLoading((currentLoading) => {
                    if (currentLoading) {
                        console.warn("Firebase auth timed out. Forcing app load.");
                        return false;
                    }
                    return currentLoading;
                });
            }, 8000);

            return unsubscribe;
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

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
