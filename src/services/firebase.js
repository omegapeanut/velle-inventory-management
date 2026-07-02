// Firebase client setup. Values come from environment variables (see .env.example),
// so no keys are hard-coded in the source. These are public client keys — access is
// controlled by Firestore security rules, not by hiding this config.
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";

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

// Real per-staff sign-in, derived from the same role + PIN the login screen already
// collects — so the UX is unchanged, but every session is now a genuine Firebase Auth
// account instead of the old "anyone gets free anonymous access" setup. Firebase Auth
// hashes and stores the password itself; we never persist it anywhere.
const AUTH_DOMAIN = "@staff.velle-app.local";
function credentialsFor(role, pin) {
  return {
    email: `${role}.${pin}${AUTH_DOMAIN}`.toLowerCase(),
    password: `velle-${role}-${pin}-auth`,
  };
}

// Signs in the matching staff account, silently provisioning it on first use.
// Returns { ok: true } on success, or { ok: false, reason } — reason "pin-changed"
// means an account for this role already exists under a different PIN (the admin
// changed it after the account was first provisioned); anything else is a
// connectivity/unexpected error.
export async function signInWithPin(role, pin) {
  if (!auth) return { ok: true }; // Firebase not configured — app runs in local-only mode.
  const { email, password } = credentialsFor(role, pin);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { ok: true };
  } catch (err) {
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        return { ok: true };
      } catch (createErr) {
        if (createErr.code === "auth/email-already-in-use") return { ok: false, reason: "pin-changed" };
        return { ok: false, reason: "error", error: createErr };
      }
    }
    return { ok: false, reason: "error", error: err };
  }
}

export const signOutUser = () => (auth ? signOut(auth).catch(() => {}) : Promise.resolve());

// Resolves once a real signed-in session exists. usePersistentState awaits this
// before subscribing, so Firestore reads/writes never race the login flow.
export const authReady = new Promise(resolve => {
  if (!auth) { resolve(true); return; }
  const unsub = onAuthStateChanged(auth, fbUser => {
    if (fbUser) { unsub(); resolve(true); }
  });
});

// Fires whenever the underlying Firebase session drops to signed-out (e.g. the
// browser's stored credentials were cleared independently of the app's own
// "velle_user" record) — lets the app fall back to the login screen instead of
// hanging on Firestore reads that will never authenticate.
export function onSignedOut(cb) {
  if (!auth) return () => {};
  let sawSignedIn = false;
  return onAuthStateChanged(auth, fbUser => {
    if (fbUser) sawSignedIn = true;
    else if (sawSignedIn) cb();
  });
}
