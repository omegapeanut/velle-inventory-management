// Firebase client setup. Values come from environment variables (see .env.example),
// so no keys are hard-coded in the source. These are public client keys — access is
// controlled by Firestore security rules, not by hiding this config.
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// When env vars are missing (e.g. before you fill .env), the app falls back to
// in-memory data instead of crashing.
export const isFirebaseConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;

// Sign in anonymously so Firestore rules can require an authenticated session.
// Resolves before any read/write is attempted (see usePersistentState).
export const authReady = auth
  ? signInAnonymously(auth).then(() => true).catch(() => false)
  : Promise.resolve(false);
