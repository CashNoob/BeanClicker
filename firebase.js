// firebase.js — Bean Clicker Firebase integration
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, doc, setDoc, onSnapshot,
    collection, query, orderBy, limit, getDocs,
    addDoc, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJuBouFP_2Ek6pVpMkY8-WEruoL6BFXGU",
  authDomain: "beanclicker-9f73e.firebaseapp.com",
  projectId: "beanclicker-9f73e",
  storageBucket: "beanclicker-9f73e.firebasestorage.app",
  messagingSenderId: "277546990541",
  appId: "1:277546990541:web:f95ab0aed6baa825fea284"
};

// Reuse existing app if already initialized
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

export async function reportCheat(username, reason) {
    try {
        await addDoc(collection(db, "bean_cheat_log"), {
            username:  username,
            reason:    reason,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent,
        });
    } catch (e) {
        console.error("Cheat log failed:", e);
    }
}

export async function saveGameState(userId, state) {
    try {
        await setDoc(doc(db, "bean_saves", userId), {
            ...state,
            savedAt: Date.now()
        });
    } catch (e) {
        console.error("Save failed:", e);
    }
}

export async function loadGameState(userId) {
    try {
        const snap = await getDoc(doc(db, "bean_saves", userId));
        return snap.exists() ? snap.data() : null;
    } catch (e) {
        console.error("Load failed:", e);
        return null;
    }
}

// userId is now the Firebase Auth UID instead of a random UUID
export async function submitScore(userId, username, level, totalBeans, prestigeCount) {
    const data = {
        username,
        level,
        totalBeans,
        prestigeCount,
        updatedAt: Date.now()
    };
    try {
        await setDoc(doc(db, "bean_leaderboard", userId), data);
    } catch (e) {
        console.error("Score submit failed:", e);
    }
}

export async function fetchLeaderboard() {
    try {
        const q    = query(collection(db, "bean_leaderboard"), orderBy("prestigeCount", "desc"), limit(20));
        const snap = await getDocs(q);
        const entries = snap.docs.map(d => d.data());
        // Sort: prestige desc, then level desc as tiebreaker
        entries.sort((a, b) => (b.prestigeCount || 0) - (a.prestigeCount || 0) || (b.level || 0) - (a.level || 0));
        return entries;
    } catch (e) {
        console.error("Leaderboard fetch failed:", e);
        return [];
    }
}

export function watchAnnouncement(callback) {
    try {
        onSnapshot(doc(db, "bean_announcements", "global"), snap => {
            if (snap.exists() && snap.data().active) callback(snap.data().message);
        });
    } catch (e) {}
}

export function watchGlobalEvent(callback) {
    try {
        onSnapshot(doc(db, "bean_events", "global"), snap => {
            if (snap.exists() && snap.data().active) callback(snap.data().eventId);
        });
    } catch (e) {}
}