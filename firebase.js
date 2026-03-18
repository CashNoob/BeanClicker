// firebase.js — Bean Clicker Firebase integration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit, getDocs }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDvwPbHf_4AAtdctHtqTBMI_BP-XMw9v5M",
    authDomain: "beanclicker-fe8eb.firebaseapp.com",
    projectId: "beanclicker-fe8eb",
    storageBucket: "beanclicker-fe8eb.firebasestorage.app",
    messagingSenderId: "558728648355",
    appId: "1:558728648355:web:99e6cfc30b3443fa319116",
    measurementId: "G-XDBSWPFSJL"
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

export async function submitScore(username, level, totalBeans, prestigeCount) {
    try {
        await setDoc(doc(db, "bean_leaderboard", getPlayerId()), {
            username,
            level,
            totalBeans,
            prestigeCount,
            updatedAt: Date.now()
        });
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