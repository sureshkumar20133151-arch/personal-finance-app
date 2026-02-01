
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInWithPopup
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

    function signup(email, password) {
        return createUserWithEmailAndPassword(auth, email, password);
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    function loginWithGoogle() {
        return signInWithPopup(auth, googleProvider);
    }

    function logout() {
        if (currentUser?.isAnonymous) {
            setCurrentUser(null);
            localStorage.removeItem('fintrack_demo_user');
            return Promise.resolve();
        }
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

            // Fallback: If Firebase doesn't respond within 2 seconds (e.g. invalid config), force load.
            setTimeout(() => {
                setLoading((currentLoading) => {
                    if (currentLoading) {
                        console.warn("Firebase auth timed out. Forcing app load.");
                        return false;
                    }
                    return currentLoading;
                });
            }, 2000);

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
        loginAsDemoUser // Exposed for the Login page
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
