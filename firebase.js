// firebase.js — Bean Clicker Firebase integration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJuBouFP_2Ek6pVpMkY8-WEruoL6BFXGU",
  authDomain: "beanclicker-9f73e.firebaseapp.com",
  projectId: "beanclicker-9f73e",
  storageBucket: "beanclicker-9f73e.firebasestorage.app",
  messagingSenderId: "277546990541",
  appId: "1:277546990541:web:f95ab0aed6baa825fea284"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

function getPlayerId() {
    let id = localStorage.getItem("beanPlayerId");
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("beanPlayerId", id);
    }
    return id;
}

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

export async function submitScore(username, level, totalBeans, prestigeCount) {
    const data = {
        username,
        level,
        totalBeans,
        prestigeCount,
        updatedAt: Date.now()
    };
    console.log("Submitting data:", data);
    try {
        await setDoc(doc(db, "bean_leaderboard", getPlayerId()), data);
        console.log("Score submitted successfully");
    } catch (e) {
        console.error("Score submit failed:", e);
    }
}

export async function fetchLeaderboard() {
    try {
        const q = query(collection(db, "bean_leaderboard"), orderBy("level", "desc"), limit(20));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
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