// auth.js — Bean Clicker Authentication
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBJuBouFP_2Ek6pVpMkY8-WEruoL6BFXGU",
    authDomain: "beanclicker-9f73e.firebaseapp.com",
    projectId: "beanclicker-9f73e",
    storageBucket: "beanclicker-9f73e.firebasestorage.app",
    messagingSenderId: "277546990541",
    appId: "1:277546990541:web:f95ab0aed6baa825fea284"
};

// Reuse existing app if already initialized
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// ── Sign up ──
export async function signUp(email, password, username) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Store username as Firebase display name
    await updateProfile(cred.user, { displayName: username });
    return cred.user;
}

// ── Sign in ──
export async function signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

// ── Sign out ──
export async function logOut() {
    await signOut(auth);
}

// ── Get current user ──
export function getCurrentUser() {
    return auth.currentUser;
}

// ── Get current user's ID token (for Firestore auth) ──
export async function getIdToken() {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
}

// ── Listen for auth state changes ──
// onReady fires with the user once auth is resolved (even on page reload)
export function onAuthReady(callback) {
    onAuthStateChanged(auth, callback);
}