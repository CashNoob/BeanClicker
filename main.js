// main.js — Bean Clicker
import { upgrades } from './upgrades.js';
import { submitScore, fetchLeaderboard, watchAnnouncement, watchGlobalEvent } from './firebase.js';

// ── Storage helpers ──
const ls = {
    get:     (k, fallback = 0) => { const v = localStorage.getItem(k); return v !== null ? Number(v) : fallback; },
    set:     (k, v) => localStorage.setItem(k, v),
    str:     (k, fallback = '') => localStorage.getItem(k) || fallback,
    getJSON: (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch { return fallback; } },
    setJSON: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

// ── State ──
let beanAmount      = ls.get("beans");
let totalEarned     = ls.get("totalEarned");
let totalClicks     = ls.get("totalClicks");
let prestigeCount   = ls.get("prestigeCount");
let prestigeMulti   = 1 + (prestigeCount * 0.1);
let activeEvent     = null;
let eventMultiplier = 1;
let unlockedAchievements = ls.getJSON("beanAchievements", []);

// ── DOM ──
const beanDisplay = document.getElementById("beans");
const beanPic     = document.getElementById("beanpic");
const beanEl      = document.querySelector(".bean");
const beanSound   = new Audio('bean.m4a');

// ── Level thresholds (100 levels, medium pace) ──
function buildThresholds() {
    const t = [0];
    let val = 30;
    for (let i = 1; i < 100; i++) {
        t.push(Math.floor(val));
        if      (i < 20)  val *= 1.45;
        else if (i < 50)  val *= 1.35;
        else if (i < 75)  val *= 1.28;
        else               val *= 1.22;
    }
    return t;
}
const levelThresholds = buildThresholds();

// ── Prestige scaling (each prestige makes levels 20% harder) ──
function prestigeScaling() { return Math.pow(1.2, prestigeCount); }

function getLevel() {
    const scale = prestigeScaling();
    let level = 1;
    for (let i = 1; i < levelThresholds.length; i++) {
        if (totalEarned >= levelThresholds[i] * scale) level = i + 1;
        else break;
    }
    return Math.min(level, 100);
}

function getNextThreshold() {
    const lvl = getLevel();
    return lvl >= 100 ? null : Math.floor(levelThresholds[lvl] * prestigeScaling());
}

// ── Achievements ──
const achievementDefs = [
    { id: 'click10',    label: '🖱️ First Harvest',     desc: 'Click 10 times',              check: () => totalClicks >= 10        },
    { id: 'click100',   label: '🖱️ Warming Up',        desc: 'Click 100 times',             check: () => totalClicks >= 100       },
    { id: 'click1k',    label: '🖱️ Bean Enthusiast',   desc: 'Click 1,000 times',           check: () => totalClicks >= 1000      },
    { id: 'click10k',   label: '🖱️ Dedicated Clicker', desc: 'Click 10,000 times',          check: () => totalClicks >= 10000     },
    { id: 'click100k',  label: '🖱️ Bean Obsessed',     desc: 'Click 100,000 times',         check: () => totalClicks >= 100000    },
    { id: 'earn100',    label: '🫘 Handful',            desc: 'Earn 100 beans',              check: () => totalEarned >= 100       },
    { id: 'earn10k',    label: '🫘 Sackful',            desc: 'Earn 10,000 beans',           check: () => totalEarned >= 10000     },
    { id: 'earn1m',     label: '🫘 Beanaire',           desc: 'Earn 1 million beans',        check: () => totalEarned >= 1e6       },
    { id: 'earn1b',     label: '🫘 Bean Billionaire',   desc: 'Earn 1 billion beans',        check: () => totalEarned >= 1e9       },
    { id: 'earn1t',     label: '🫘 Bean Trillionaire',  desc: 'Earn 1 trillion beans',       check: () => totalEarned >= 1e12      },
    { id: 'level10',    label: '⭐ Sprout',             desc: 'Reach level 10',              check: () => getLevel() >= 10         },
    { id: 'level25',    label: '⭐ Seedling',           desc: 'Reach level 25',              check: () => getLevel() >= 25         },
    { id: 'level50',    label: '⭐ Sapling',            desc: 'Reach level 50',              check: () => getLevel() >= 50         },
    { id: 'level75',    label: '⭐ Full Grown',         desc: 'Reach level 75',              check: () => getLevel() >= 75         },
    { id: 'level100',   label: '⭐ The Bean Master',    desc: 'Reach level 100',             check: () => getLevel() >= 100        },
    { id: 'upg5',       label: '🛒 Shopper',            desc: 'Own 5 of any upgrade',        check: () => Object.values(upgrades).some(u => u.owned >= 5)   },
    { id: 'upg25',      label: '🛒 Bulk Order',         desc: 'Own 25 of any upgrade',       check: () => Object.values(upgrades).some(u => u.owned >= 25)  },
    { id: 'upg100',     label: '🛒 Bean Hoarder',       desc: 'Own 100 of any upgrade',      check: () => Object.values(upgrades).some(u => u.owned >= 100) },
    { id: 'prestige1',  label: '🔁 Reborn',             desc: 'Prestige for the first time', check: () => prestigeCount >= 1       },
    { id: 'prestige5',  label: '🔁 Bean Lives',         desc: 'Prestige 5 times',            check: () => prestigeCount >= 5       },
    { id: 'allupgrades',label: '🏆 Full Garden',        desc: 'Unlock every upgrade',        check: () => Object.values(upgrades).every(u => u.owned > 0)   },
];

// ── Random events ──
const eventDefs = [
    {
        id: 'rain', title: '🌧️ Bean Rain!', desc: 'BPS x3 for 20 seconds!',
        duration: 20000, color: '#4fc3f7',
        onStart: () => { eventMultiplier = 3; },
        onEnd:   () => { eventMultiplier = 1; },
    },
    {
        id: 'frenzy', title: '⚡ Click Frenzy!', desc: 'Clicks worth 5x for 15 seconds!',
        duration: 15000, color: '#ffb300',
        onStart: () => { eventMultiplier = 5; },
        onEnd:   () => { eventMultiplier = 1; },
    },
    {
        id: 'drop', title: '🎁 Bean Drop!', desc: '',
        duration: 0, color: '#66bb6a',
        onStart: () => {
            const bonus = Math.floor(Math.max(beanAmount * 0.1, 50));
            beanAmount += bonus;
            totalEarned += bonus;
            updateBeanDisplay();
            ls.set("beans", beanAmount);
            ls.set("totalEarned", totalEarned);
            eventDefs.find(e => e.id === 'drop').desc = `Free ${fmt(bonus)} beans!`;
        },
        onEnd: () => {},
    },
    {
        id: 'blight', title: '🐛 Bean Blight!', desc: 'Lost 15% of your beans!',
        duration: 0, color: '#ef5350',
        onStart: () => {
            beanAmount = Math.floor(beanAmount * 0.85);
            updateBeanDisplay();
            ls.set("beans", beanAmount);
        },
        onEnd: () => {},
    },
    {
        id: 'harvest', title: '🌾 Double Harvest!', desc: 'BPS x2 for 30 seconds!',
        duration: 30000, color: '#aed581',
        onStart: () => { eventMultiplier = 2; },
        onEnd:   () => { eventMultiplier = 1; },
    },
];

// ── Utility ──
function fmt(n) {
    if (n >= 1e18) return (n / 1e18).toFixed(1) + 'Qi';
    if (n >= 1e15) return (n / 1e15).toFixed(1) + 'Q';
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9)  return (n / 1e9).toFixed(1)  + 'B';
    if (n >= 1e6)  return (n / 1e6).toFixed(1)  + 'M';
    if (n >= 1e3)  return (n / 1e3).toFixed(1)  + 'K';
    return Math.floor(n).toString();
}

function getUpgradeCost(u) {
    return Math.floor(u.cost * Math.pow(1.10, u.owned));
}

// ── Display updates ──
function updateBeanDisplay() {
    beanDisplay.textContent = fmt(beanAmount);
}

function updateBPSDisplay() {
    let total = 0;
    for (const id in upgrades) total += upgrades[id].bps * upgrades[id].owned;
    const blight = activeEvent && activeEvent.id === 'blight' ? 1 : 1;
    const multiplier = activeEvent && (activeEvent.id === 'rain' || activeEvent.id === 'harvest') ? eventMultiplier : 1;
    total = Math.floor(total * prestigeMulti * multiplier);
    document.getElementById("ticker").textContent    = `BPS: ${fmt(total)}`;
    document.getElementById("perSecond").textContent = `${fmt(total)} per second`;
}

function updateLevelDisplay() {
    const level = getLevel();
    const next  = getNextThreshold();
    const el    = document.getElementById("levelDisplay");
    if (next !== null) {
        const pct = Math.min(100, Math.floor((totalEarned / next) * 100));
        el.innerHTML = `LVL ${level} <span class="level-bar-wrap"><span class="level-bar-fill" style="width:${pct}%"></span></span> <span class="level-next">${fmt(totalEarned)} / ${fmt(next)}</span>`;
    } else {
        el.innerHTML = `LVL 100 <span class="level-max">✦ MAX</span>`;
    }
}

function updateCardVisibility() {
    const level = getLevel();
    for (const id in upgrades) {
        const card = document.getElementById(id);
        if (!card) continue;
        card.style.display = upgrades[id].unlockLevel <= level ? '' : 'none';
    }
}

function updateCardText(id) {
    const card = document.getElementById(id);
    if (!card) return;
    const u = upgrades[id];
    const nameEl  = card.querySelector('.card-name');
    const countEl = card.querySelector('.card-count');
    const costEl  = card.querySelector('.card-cost');
    if (nameEl)  nameEl.textContent  = `${u.emoji} ${u.name}`;
    if (countEl) countEl.textContent = u.owned;
    if (costEl)  costEl.textContent  = `🫘 ${fmt(getUpgradeCost(u))}`;
}

function updatePrestigeDisplay() {
    const el = document.getElementById("prestigeInfo");
    if (!el) return;
    const scalePct = Math.round((prestigeScaling() - 1) * 100);
    el.textContent = prestigeCount > 0
        ? `✦ ${prestigeCount} Prestige${prestigeCount !== 1 ? 's' : ''} · +${Math.round((prestigeMulti - 1) * 100)}% beans · Levels +${scalePct}% harder`
        : 'No prestiges yet. Each prestige makes leveling 20% harder but gives +10% beans permanently.';
}

// ── Build upgrade cards dynamically ──
function buildUpgradeCards() {
    const list = document.getElementById("upgradeList");
    list.innerHTML = '';
    let i = 0;
    for (const id in upgrades) {
        const u = upgrades[id];
        const card = document.createElement('div');
        card.id = id;
        // Add 'top-tooltip' class to the first two cards
        card.className = 'upgrade-card' + (i < 2 ? ' top-tooltip' : '');
        i++;
        const statType = u.bps > 0 && u.bpc > 0 ? `+${fmt(u.bps)} BPS & +${fmt(u.bpc)} BPC`
                       : u.bpc > 0 ? `+${fmt(u.bpc)} per click`
                       : `+${fmt(u.bps)} BPS`;
        card.innerHTML = `
            <div class="card-main">
                <span class="card-name">${u.emoji} ${u.name}</span>
                <span class="card-count">${u.owned}</span>
            </div>
            <div class="card-cost">🫘 ${fmt(u.cost)}</div>
            <div class="card-tooltip">
                <div class="tooltip-stat">${statType}</div>
                <div class="tooltip-desc">${u.desc}</div>
                <div class="tooltip-unlock">Unlocks at level ${u.unlockLevel}</div>
            </div>
        `;
        card.addEventListener('click', () => buyUpgrade(id));
        list.appendChild(card);
    }
}

// ── Toast ──
function showToast(title, desc, color = '#4caf50') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-title" style="color:${color}">${title}</span>${desc ? `<span class="toast-desc">${desc}</span>` : ''}`;
    document.getElementById('toastContainer').appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ── Announcement banner ──
function showBanner(msg) {
    const existing = document.getElementById('announcementBanner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.id = 'announcementBanner';
    banner.className = 'announcement-banner';
    banner.innerHTML = `<span class="announcement-text">📢 ${msg}</span><button class="announcement-close" onclick="this.parentElement.remove()">✕</button>`;
    document.body.appendChild(banner);
}

// ── Achievements ──
function checkAchievements() {
    for (const def of achievementDefs) {
        if (!unlockedAchievements.includes(def.id) && def.check()) {
            unlockedAchievements.push(def.id);
            ls.setJSON("beanAchievements", unlockedAchievements);
            showToast(`🏆 ${def.label}`, def.desc, '#ffd54f');
            renderAchievements();
        }
    }
}

function renderAchievements() {
    const container = document.getElementById('achievementList');
    if (!container) return;
    container.innerHTML = '';
    const earned = achievementDefs.filter(d => unlockedAchievements.includes(d.id));
    const locked  = achievementDefs.filter(d => !unlockedAchievements.includes(d.id));
    document.getElementById('achCount').textContent = `${earned.length} / ${achievementDefs.length}`;
    for (const def of [...earned, ...locked]) {
        const isEarned = unlockedAchievements.includes(def.id);
        const div = document.createElement('div');
        div.className = 'achievement-item' + (isEarned ? ' earned' : '');
        div.innerHTML = `<span class="ach-label">${isEarned ? def.label : '???'}</span><span class="ach-desc">${isEarned ? def.desc : 'Keep playing...'}</span>`;
        container.appendChild(div);
    }
}

// ── Random events ──
function triggerEvent(def) {
    if (activeEvent) return;
    activeEvent = def;
    def.onStart();
    showToast(def.title, def.desc, def.color);
    updateBPSDisplay();
    if (def.duration > 0) {
        const bar = document.getElementById('eventBar');
        bar.style.display = 'flex';
        bar.querySelector('.event-label').textContent = def.title;
        let remaining = def.duration;
        const tick = setInterval(() => {
            remaining -= 100;
            bar.querySelector('.event-fill').style.width = ((remaining / def.duration) * 100) + '%';
            if (remaining <= 0) {
                clearInterval(tick);
                bar.style.display = 'none';
                def.onEnd();
                activeEvent = null;
                updateBPSDisplay();
            }
        }, 100);
    } else {
        activeEvent = null;
    }
}

function scheduleEvent() {
    setTimeout(() => {
        triggerEvent(eventDefs[Math.floor(Math.random() * eventDefs.length)]);
        scheduleEvent();
    }, 60000 + Math.random() * 90000);
}

// ── Click handler ──
let lastClick = 0;
const CLICK_COOLDOWN = 33; // ~30 clicks/sec max

function beanclicker() {
    const now = Date.now();
    if (now - lastClick < CLICK_COOLDOWN) return;
    lastClick = now;

    let clicktotal = 1;
    for (const id in upgrades) clicktotal += upgrades[id].bpc * upgrades[id].owned;
    const frenzy = activeEvent && activeEvent.id === 'frenzy' ? eventMultiplier : 1;
    clicktotal = Math.floor(clicktotal * prestigeMulti * frenzy);

    beanAmount  += clicktotal;
    totalEarned += clicktotal;
    totalClicks++;

    updateBeanDisplay();
    ls.set("beans", beanAmount);
    ls.set("totalEarned", totalEarned);
    ls.set("totalClicks", totalClicks);

    // audio
    const sound = beanSound.cloneNode();
    sound.volume = 1;
    sound.play();

    // float text
    spawnFloatText(`+${fmt(clicktotal)}`);

    // bean animation
    beanEl.classList.remove('bean-clicked');
    void beanEl.offsetWidth;
    beanEl.classList.add('bean-clicked');

    updateLevelDisplay();
    updateCardVisibility();
    checkAchievements();
}

// ── BPS tick ──
function bpsTick() {
    let total = 0;
    for (const id in upgrades) total += upgrades[id].bps * upgrades[id].owned;
    const multiplier = activeEvent && (activeEvent.id === 'rain' || activeEvent.id === 'harvest') ? eventMultiplier : 1;
    total = Math.floor(total * prestigeMulti * multiplier);
    if (total > 0) {
        beanAmount  += total;
        totalEarned += total;
        updateBeanDisplay();
        ls.set("beans", beanAmount);
        ls.set("totalEarned", totalEarned);
    }
    updateBPSDisplay();
    updateLevelDisplay();
    updateCardVisibility();
    checkAchievements();
}
setInterval(bpsTick, 1000);

// ── Float text ──
function spawnFloatText(text) {
    const el = document.createElement("div");
    el.textContent = text;
    el.className = "float-text";
    document.body.appendChild(el);
    const rect = beanPic.getBoundingClientRect();
    el.style.left = (rect.left + rect.width / 2 + (Math.random() * 80 - 40)) + "px";
    el.style.top  = (rect.top + (Math.random() * 60 - 30)) + "px";
    setTimeout(() => el.remove(), 800);
}

// ── Flash no funds ──
function flashNoFunds(id) {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.remove('no-funds');
    void card.offsetWidth;
    card.classList.add('no-funds');
    setTimeout(() => card.classList.remove('no-funds'), 400);
}

// ── Buy upgrade ──
function buyUpgrade(id) {
    const u = upgrades[id];
    const cost = getUpgradeCost(u);
    if (beanAmount < cost) { flashNoFunds(id); return; }
    beanAmount -= cost;
    u.owned++;
    ls.set("beans", beanAmount);
    ls.set(`upg_${id}`, u.owned);
    updateCardText(id);
    updateBeanDisplay();
    updateBPSDisplay();
    updateLevelDisplay();
    updateCardVisibility();
    checkAchievements();
}

// ── Prestige ──
function prestige() {
    if (getLevel() < 100) {
        showToast('⚠️ Not Yet', 'Reach level 100 to prestige.', '#ef5350');
        return;
    }
    if (!confirm(`Prestige? Everything resets but you gain a permanent +10% bean multiplier.\nCurrent bonus: +${Math.round((prestigeMulti - 1) * 100)}%`)) return;
    prestigeCount++;
    prestigeMulti = 1 + (prestigeCount * 0.1);
    beanAmount = 0; totalEarned = 0; totalClicks = 0;
    for (const id in upgrades) { upgrades[id].owned = 0; ls.set(`upg_${id}`, 0); }
    ls.set("beans", 0);
    ls.set("totalEarned", 0);
    ls.set("totalClicks", 0);
    ls.set("prestigeCount", prestigeCount);
    showToast('🔁 Prestige!', `+10% bonus. Total: +${Math.round((prestigeMulti - 1) * 100)}%`, '#ce93d8');
    updateBeanDisplay();
    updateBPSDisplay();
    updateLevelDisplay();
    updateCardVisibility();
    updatePrestigeDisplay();
    for (const id in upgrades) updateCardText(id);
    checkAchievements();
}

// ── Tabs ──
function switchTab(tabName, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    if (tabName === 'leaderboard') loadLeaderboard();
}

// ── Leaderboard ──
function saveUsername() {
    const input = document.getElementById('usernameInput');
    const name = input.value.trim();
    if (!name) return;
    localStorage.setItem('beanUsername', name);
    showUsernameDisplay(name);
    submitScore(name, getLevel(), totalEarned, prestigeCount);
    loadLeaderboard();
}

function showUsernameDisplay(name) {
    document.getElementById('usernameSection').style.display = 'none';
    const el = document.getElementById('currentUser');
    el.style.display = 'block';
    el.innerHTML = `<span class="current-user-name">✦ ${name}</span> <span class="current-user-change" onclick="changeUsername()">change</span>`;
}

function changeUsername() {
    document.getElementById('usernameSection').style.display = 'flex';
    document.getElementById('currentUser').style.display = 'none';
}

let lastLBSubmit = 0;
async function loadLeaderboard() {
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '<div class="lb-loading">loading...</div>';
    const username = localStorage.getItem('beanUsername');
    const now = Date.now();
    if (username && now - lastLBSubmit > 30000) {
        submitScore(username, getLevel(), totalEarned, prestigeCount);
        lastLBSubmit = now;
    }
    const entries = await fetchLeaderboard();
    if (entries.length === 0) {
        list.innerHTML = '<div class="lb-loading">No entries yet.</div>';
        return;
    }
    list.innerHTML = '';
    entries.forEach((e, i) => {
        const div = document.createElement('div');
        const isMe = localStorage.getItem('beanUsername') === e.username;
        div.className = 'lb-entry' + (isMe ? ' lb-me' : '');

        const rank = document.createElement('span');
        rank.className = 'lb-rank';
        rank.textContent = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

        const name = document.createElement('span');
        name.className = 'lb-name';
        name.textContent = e.username;

        const level = document.createElement('span');
        level.className = 'lb-level';
        level.textContent = `LVL ${e.level}`;

        div.appendChild(rank);
        div.appendChild(name);
        div.appendChild(level);

        if (e.prestigeCount > 0) {
            const prestige = document.createElement('span');
            prestige.className = 'lb-prestige';
            prestige.textContent = `✦${e.prestigeCount}`;
            div.appendChild(prestige);
        }
        list.appendChild(div);
    });
}

// ── Dev reset ──
function devReset() { localStorage.clear(); location.reload(); }

// ── Init ──
function Initialize() {
    // restore state
    for (const id in upgrades) {
        const saved = ls.get(`upg_${id}`);
        if (saved > 0) upgrades[id].owned = saved;
    }

    buildUpgradeCards();
    updateBeanDisplay();
    updateBPSDisplay();
    updateLevelDisplay();
    updateCardVisibility();
    updatePrestigeDisplay();
    renderAchievements();
    scheduleEvent();

    // restore username
    const savedName = localStorage.getItem('beanUsername');
    if (savedName) showUsernameDisplay(savedName);

    // firebase watchers
    watchAnnouncement(msg => showBanner(msg));
    watchGlobalEvent(eventId => {
        const def = eventDefs.find(e => e.id === eventId);
        if (def) triggerEvent(def);
    });

    // bean click
    beanPic.addEventListener("click", beanclicker);
    beanEl.addEventListener('animationend', () => beanEl.classList.remove('bean-clicked'));

    // prevent right click
    document.addEventListener('contextmenu', e => e.preventDefault());

    // prevent zoom
    document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    document.addEventListener('keydown', e => { if (e.ctrlKey && ['+','-','='].includes(e.key)) e.preventDefault(); });
    document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
}

// ── Expose globals for HTML onclick attributes ──
window.switchTab      = switchTab;
window.saveUsername   = saveUsername;
window.changeUsername = changeUsername;
window.loadLeaderboard= loadLeaderboard;
window.devReset       = devReset;
window.prestige       = prestige;

Initialize();