
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBmyy7c2ScBC1xrAStSjhgkL-0ouvY5-Jo",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "listing-generator-31b39.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "listing-generator-31b39",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "listing-generator-31b39.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "457615196609",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:457615196609:web:37c6b38cacc8f570a7af40"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
