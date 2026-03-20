// main.js — Bean Clicker (Refactored)
import { upgrades } from './upgrades.js';
import { themes, getActiveTheme, getUnlockedThemes } from './themes.js';
import { upgradesSpace } from './upgrades-space.js';
import { upgradesLava } from './upgrades-lava.js';
import { prestigeUpgrades, getAvailablePP, computePP, getPrestigeEffects } from './prestigeShop.js';
import { signUp, signIn, logOut, onAuthReady, getCurrentUser } from './auth.js';
import { submitScore, fetchLeaderboard, watchAnnouncement, watchGlobalEvent, reportCheat, saveGameState, loadGameState } from './firebase.js';

// ── Storage helpers ──
const ls = {
    get:     (k, fallback = 0) => { const v = localStorage.getItem(k); if (v === null) return fallback; const n = Number(v); return isNaN(n) ? fallback : n; },
    set:     (k, v) => localStorage.setItem(k, v),
    str:     (k, fallback = '') => localStorage.getItem(k) || fallback,
    getJSON: (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch { return fallback; } },
    setJSON: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

const worldUpgrades = {
    space: upgradesSpace,
    lava:  upgradesLava,
};

// ══════════════════════════════════════════════
//  CENTRALIZED GAME STATE
// ══════════════════════════════════════════════
const state = {
    beans:          ls.get("beans"),
    totalEarned:    ls.get("totalEarned"),
    totalClicks:    ls.get("totalClicks"),
    prestigeCount:  ls.get("prestigeCount"),
    activeThemeId:  ls.str("beanTheme", "default"),
    achievements:   ls.getJSON("beanAchievements", []),
    activeEvent:    null,
    eventMultiplier: 1,
    prestigeEffects: getPrestigeEffects(),
    currentUser:    null,
    gameInitialized: false,
};

// ── Convenience accessors ──
function getPrestigeMulti() {
    return 1 + (state.prestigeCount * state.prestigeEffects.prestigePerRun);
}

function getWorldUpgrades() {
    return worldUpgrades[state.activeThemeId] || null;
}

// ── Persist core state to localStorage ──
function persistCore() {
    // Never persist NaN — sanitize before writing
    if (isNaN(state.beans))        state.beans = 0;
    if (isNaN(state.totalEarned))  state.totalEarned = 0;
    if (isNaN(state.totalClicks))  state.totalClicks = 0;
    if (isNaN(state.prestigeCount)) state.prestigeCount = 0;

    ls.set("beans",         state.beans);
    ls.set("totalEarned",   state.totalEarned);
    ls.set("totalClicks",   state.totalClicks);
    ls.set("prestigeCount", state.prestigeCount);
}

// ── DOM refs (cached once) ──
const dom = {
    beanDisplay:   document.getElementById("beans"),
    beanPic:       document.getElementById("beanpic"),
    beanEl:        document.querySelector(".bean"),
    ticker:        document.getElementById("ticker"),
    perSecond:     document.getElementById("perSecond"),
    levelDisplay:  document.getElementById("levelDisplay"),
    eventBar:      document.getElementById("eventBar"),
    toastContainer:document.getElementById("toastContainer"),
    upgradeList:   document.getElementById("upgradeList"),
    worldUpgradeList: document.getElementById("worldUpgradeList"),
    worldUpgradeTab:  document.getElementById("worldUpgradeTab"),
    achievementList:  document.getElementById("achievementList"),
    achCount:         document.getElementById("achCount"),
    prestigeInfo:     document.getElementById("prestigeInfo"),
    prestigeDesc:     document.getElementById("prestigeDesc"),
    ppDisplay:        document.getElementById("ppDisplay"),
    prestigeShopList: document.getElementById("prestigeShopList"),
    themeSelector:    document.getElementById("themeSelector"),
    cheatNotice:      document.getElementById("cheatNotice"),
    authOverlay:      document.getElementById("authOverlay"),
    usernameSection:  document.getElementById("usernameSection"),
    currentUserEl:    document.getElementById("currentUser"),
    leaderboardList:  document.getElementById("leaderboardList"),
};

// ══════════════════════════════════════════════
//  AUDIO POOL (reuse nodes instead of cloneNode)
// ══════════════════════════════════════════════
const AUDIO_POOL_SIZE = 6;
const audioPool = [];
let audioIndex = 0;

function initAudioPool() {
    for (let i = 0; i < AUDIO_POOL_SIZE; i++) {
        const a = new Audio('bean.m4a');
        a.volume = 1;
        audioPool.push(a);
    }
}

function playClickSound() {
    const sound = audioPool[audioIndex];
    sound.currentTime = 0;
    sound.play().catch(() => {}); // ignore autoplay blocks
    audioIndex = (audioIndex + 1) % AUDIO_POOL_SIZE;
}

// ══════════════════════════════════════════════
//  LEVEL SYSTEM
// ══════════════════════════════════════════════
const levelThresholds = (() => {
    const t = [0];
    let val = 30;
    for (let i = 1; i < 600; i++) {
        t.push(Math.floor(val));
        val *= 1.4;
    }
    return t;
})();

function getMaxLevel() {
    return 100 + (state.prestigeCount * 50);
}

function prestigeScaling() {
    return Math.pow(1.2, state.prestigeCount);
}

function getLevel() {
    const scale = prestigeScaling();
    let level = 1;
    for (let i = 1; i < levelThresholds.length; i++) {
        if (state.totalEarned >= levelThresholds[i] * scale) level = i + 1;
        else break;
    }
    return Math.min(level, getMaxLevel());
}

function getNextThreshold() {
    const lvl = getLevel();
    return lvl >= getMaxLevel() ? null : Math.floor(levelThresholds[lvl] * prestigeScaling());
}

// ══════════════════════════════════════════════
//  BPS / BPC CALCULATION
// ══════════════════════════════════════════════
function calcBPS() {
    let total = 0;
    for (const id in upgrades) total += upgrades[id].bps * (upgrades[id].owned || 0);
    const world = getWorldUpgrades();
    if (world) for (const id in world) total += world[id].bps * (world[id].owned || 0);
    const result = total * (state.prestigeEffects.bpsMulti || 1) * (state.prestigeEffects.globalMulti || 1);
    return isNaN(result) ? 0 : result;
}

function calcBPC() {
    let total = 1;
    for (const id in upgrades) total += upgrades[id].bpc * (upgrades[id].owned || 0);
    const world = getWorldUpgrades();
    if (world) for (const id in world) total += world[id].bpc * (world[id].owned || 0);
    const result = total * (state.prestigeEffects.clickMulti || 1) * (state.prestigeEffects.globalMulti || 1);
    return isNaN(result) ? 1 : result;
}

// ══════════════════════════════════════════════
//  NUMBER FORMATTING (extended range)
// ══════════════════════════════════════════════
const FMT_TIERS = [
    [1e21, 'Sx'], [1e18, 'Qi'], [1e15, 'Q'], [1e12, 'T'],
    [1e9,  'B'],  [1e6,  'M'],  [1e3,  'K'],
];

function fmt(n) {
    for (const [threshold, suffix] of FMT_TIERS) {
        if (n >= threshold) return (n / threshold).toFixed(1) + suffix;
    }
    return Math.floor(n).toString();
}

function getUpgradeCost(u) {
    const cost = Math.floor(u.cost * Math.pow(1.10, u.owned || 0) * (state.prestigeEffects.costReduction || 1));
    return isNaN(cost) ? u.cost : cost;
}

// ══════════════════════════════════════════════
//  ACHIEVEMENTS
// ══════════════════════════════════════════════
const achievementDefs = [
    { id: 'click10',    label: '🖱️ First Harvest',     desc: 'Click 10 times',              check: () => state.totalClicks >= 10        },
    { id: 'click100',   label: '🖱️ Warming Up',        desc: 'Click 100 times',             check: () => state.totalClicks >= 100       },
    { id: 'click1k',    label: '🖱️ Bean Enthusiast',   desc: 'Click 1,000 times',           check: () => state.totalClicks >= 1000      },
    { id: 'click10k',   label: '🖱️ Dedicated Clicker', desc: 'Click 10,000 times',          check: () => state.totalClicks >= 10000     },
    { id: 'click100k',  label: '🖱️ Bean Obsessed',     desc: 'Click 100,000 times',         check: () => state.totalClicks >= 100000    },
    { id: 'earn100',    label: '🫘 Handful',            desc: 'Earn 100 beans',              check: () => state.totalEarned >= 100       },
    { id: 'earn10k',    label: '🫘 Sackful',            desc: 'Earn 10,000 beans',           check: () => state.totalEarned >= 10000     },
    { id: 'earn1m',     label: '🫘 Beanaire',           desc: 'Earn 1 million beans',        check: () => state.totalEarned >= 1e6       },
    { id: 'earn1b',     label: '🫘 Bean Billionaire',   desc: 'Earn 1 billion beans',        check: () => state.totalEarned >= 1e9       },
    { id: 'earn1t',     label: '🫘 Bean Trillionaire',  desc: 'Earn 1 trillion beans',       check: () => state.totalEarned >= 1e12      },
    { id: 'level10',    label: '⭐ Sprout',             desc: 'Reach level 10',              check: () => getLevel() >= 10         },
    { id: 'level25',    label: '⭐ Seedling',           desc: 'Reach level 25',              check: () => getLevel() >= 25         },
    { id: 'level50',    label: '⭐ Sapling',            desc: 'Reach level 50',              check: () => getLevel() >= 50         },
    { id: 'level75',    label: '⭐ Full Grown',         desc: 'Reach level 75',              check: () => getLevel() >= 75         },
    { id: 'level100',   label: '⭐ The Bean Master',    desc: 'Reach level 100',             check: () => getLevel() >= 100        },
    { id: 'upg5',       label: '🛒 Shopper',            desc: 'Own 5 of any upgrade',        check: () => Object.values(upgrades).some(u => u.owned >= 5)   },
    { id: 'upg25',      label: '🛒 Bulk Order',         desc: 'Own 25 of any upgrade',       check: () => Object.values(upgrades).some(u => u.owned >= 25)  },
    { id: 'upg100',     label: '🛒 Bean Hoarder',       desc: 'Own 100 of any upgrade',      check: () => Object.values(upgrades).some(u => u.owned >= 100) },
    { id: 'prestige1',  label: '🔁 Reborn',             desc: 'Prestige for the first time', check: () => state.prestigeCount >= 1       },
    { id: 'prestige3',  label: '🔁 Three Lives',        desc: 'Prestige 3 times',            check: () => state.prestigeCount >= 3       },
    { id: 'prestige5',  label: '🔁 Bean Lives',         desc: 'Prestige 5 times',            check: () => state.prestigeCount >= 5       },
    { id: 'prestige10', label: '🔁 Eternal Returner',   desc: 'Prestige 10 times',           check: () => state.prestigeCount >= 10      },
    { id: 'spacebean',  label: '🌌 Cosmonaut',          desc: 'Unlock Space theme',          check: () => state.prestigeCount >= 1       },
    { id: 'voidbean',   label: '🕳️ Void Walker',        desc: 'Unlock Void theme',           check: () => state.prestigeCount >= 5       },
    { id: 'allupgrades',label: '🏆 Full Garden',        desc: 'Unlock every upgrade',        check: () => Object.values(upgrades).every(u => u.owned > 0)   },
    { id: 'ppspend1',   label: '⚗️ Prestige Scholar',   desc: 'Buy a prestige upgrade',      check: () => Object.values(prestigeUpgrades).some(u => u.level > 0) },
];

// ══════════════════════════════════════════════
//  RANDOM EVENTS (no global mutation — pass multiplier through state)
// ══════════════════════════════════════════════
const eventDefs = [
    {
        id: 'rain', title: '🌧️ Bean Rain!', desc: 'BPS x3 for 20 seconds!',
        duration: 20000, color: '#4fc3f7',
        onStart: () => { state.eventMultiplier = 3; },
        onEnd:   () => { state.eventMultiplier = 1; },
    },
    {
        id: 'frenzy', title: '⚡ Click Frenzy!', desc: 'Clicks worth 5x for 15 seconds!',
        duration: 15000, color: '#ffb300',
        onStart: () => { state.eventMultiplier = 5; },
        onEnd:   () => { state.eventMultiplier = 1; },
    },
    {
        id: 'drop', title: '🎁 Bean Drop!', desc: '',
        duration: 0, color: '#66bb6a',
        onStart: () => {
            const bonus = Math.floor(Math.max(state.beans * 0.1, 50));
            state.beans     += bonus;
            state.totalEarned += bonus;
            updateBeanDisplay();
            persistCore();
            eventDefs.find(e => e.id === 'drop').desc = `Free ${fmt(bonus)} beans!`;
        },
        onEnd: () => {},
    },
    {
        id: 'blight', title: '🐛 Bean Blight!', desc: '',
        duration: 0, color: '#ef5350',
        onStart: () => {
            const blightPct = 0.15 - state.prestigeEffects.blightReduction;
            state.beans = Math.floor(state.beans * (1 - blightPct));
            eventDefs.find(e => e.id === 'blight').desc = `Lost ${Math.round(blightPct * 100)}% of your beans!`;
            updateBeanDisplay();
            persistCore();
        },
        onEnd: () => {},
    },
    {
        id: 'harvest', title: '🌾 Double Harvest!', desc: 'BPS x2 for 30 seconds!',
        duration: 30000, color: '#aed581',
        onStart: () => { state.eventMultiplier = 2; },
        onEnd:   () => { state.eventMultiplier = 1; },
    },
];

// ══════════════════════════════════════════════
//  THEME SYSTEM
// ══════════════════════════════════════════════
function applyTheme(themeId) {
    const unlocked = getUnlockedThemes(state.prestigeCount);
    const theme = unlocked.find(t => t.id === themeId) || unlocked[unlocked.length - 1];
    state.activeThemeId = theme.id;
    ls.set("beanTheme", theme.id);

    themes.forEach(t => document.body.classList.remove(t.bodyClass));
    document.body.classList.add(theme.bodyClass);

    const beanLabelEl = document.getElementById("beanLabel");
    if (beanLabelEl) beanLabelEl.textContent = theme.beanLabel;
    const beanEmojiEl = document.getElementById("beanEmoji");
    if (beanEmojiEl) beanEmojiEl.textContent = theme.emoji;

    buildUpgradeCards();
}

function buildThemeSelector() {
    if (!dom.themeSelector) return;
    dom.themeSelector.innerHTML = '';
    const unlocked = getUnlockedThemes(state.prestigeCount);
    const locked   = themes.filter(t => t.unlockPrestige > state.prestigeCount);

    for (const theme of unlocked) {
        const btn = document.createElement('button');
        btn.className = 'theme-btn' + (theme.id === state.activeThemeId ? ' theme-active' : '');
        btn.innerHTML = `<span class="theme-emoji">${theme.emoji}</span><span class="theme-name">${theme.name}</span><span class="theme-desc">${theme.desc}</span>`;
        btn.addEventListener('click', () => {
            applyTheme(theme.id);
            buildThemeSelector();
        });
        dom.themeSelector.appendChild(btn);
    }
    for (const theme of locked) {
        const div = document.createElement('div');
        div.className = 'theme-btn theme-locked';
        div.innerHTML = `<span class="theme-emoji">🔒</span><span class="theme-name">${theme.name}</span><span class="theme-desc">Unlocks at prestige ${theme.unlockPrestige}</span>`;
        dom.themeSelector.appendChild(div);
    }
}

// ══════════════════════════════════════════════
//  PRESTIGE SHOP
// ══════════════════════════════════════════════
function getPPUpgradeCost(id) {
    const u = prestigeUpgrades[id];
    return u.cost + u.level;
}

function buildPrestigeShop() {
    if (!dom.prestigeShopList) return;
    dom.prestigeShopList.innerHTML = '';

    const pp = getAvailablePP(state.prestigeCount);
    const totalPP = computePP(state.prestigeCount);
    if (dom.ppDisplay) {
        dom.ppDisplay.innerHTML = `
            <div class="pp-header">
                <span class="pp-amount">✦ ${pp}</span>
                <span class="pp-label">Prestige Points</span>
            </div>
            <div class="pp-sub">Total earned: ${totalPP} PP from ${state.prestigeCount} prestige${state.prestigeCount !== 1 ? 's' : ''}</div>
        `;
    }

    for (const id in prestigeUpgrades) {
        const u         = prestigeUpgrades[id];
        const cost      = getPPUpgradeCost(id);
        const maxed     = u.level >= u.maxLevel;
        const canAfford = pp >= cost;

        // Build level pips
        let pips = '';
        for (let i = 0; i < u.maxLevel; i++) {
            pips += `<span class="pshop-pip${i < u.level ? ' pip-filled' : ''}"></span>`;
        }

        const card = document.createElement('div');
        card.className = 'pshop-card' + (maxed ? ' pshop-maxed' : '') + (canAfford && !maxed ? ' pshop-affordable' : '') + (!canAfford && !maxed ? ' pshop-broke' : '');
        card.innerHTML = `
            <div class="pshop-top">
                <span class="pshop-emoji">${u.emoji}</span>
                <div class="pshop-info">
                    <span class="pshop-name">${u.name}</span>
                    <span class="pshop-desc">${u.desc}</span>
                </div>
            </div>
            <div class="pshop-pips">${pips}</div>
            <div class="pshop-bottom">
                <span class="pshop-effect">${u.effectDesc(u.level)}</span>
                <span class="pshop-cost">${maxed ? '✦ MAX' : `${cost} PP`}</span>
            </div>
        `;
        if (!maxed) card.addEventListener('click', () => buyPrestigeUpgrade(id));
        dom.prestigeShopList.appendChild(card);
    }
}

function buyPrestigeUpgrade(id) {
    const u = prestigeUpgrades[id];
    if (u.level >= u.maxLevel) return;
    const cost = getPPUpgradeCost(id);
    const pp   = getAvailablePP(state.prestigeCount);
    if (pp < cost) {
        showToast('✦ Not Enough PP', 'Prestige more to earn points.', '#ef5350');
        return;
    }
    u.level++;
    ls.set(`pshop_${id}`, u.level);
    state.prestigeEffects = getPrestigeEffects();
    showToast(`${u.emoji} ${u.name}`, `Level ${u.level} — ${u.effectDesc(u.level)}`, '#ce93d8');
    buildPrestigeShop();
    buildThemeSelector();
    updatePrestigeDisplay();
    checkAchievements();
    saveToCloud();
}

// ══════════════════════════════════════════════
//  DISPLAY UPDATES
// ══════════════════════════════════════════════
function updateBeanDisplay() {
    dom.beanDisplay.textContent = fmt(state.beans);
}

function updateBPSDisplay() {
    const multiplier = state.activeEvent && (state.activeEvent.id === 'rain' || state.activeEvent.id === 'harvest') ? state.eventMultiplier : 1;
    const total = Math.floor(calcBPS() * getPrestigeMulti() * multiplier);
    dom.ticker.textContent    = `BPS: ${fmt(total)}`;
    dom.perSecond.textContent = `${fmt(total)} per second`;
}

function updateLevelDisplay() {
    const level = getLevel();
    const next  = getNextThreshold();
    if (next !== null) {
        const pct = Math.min(100, Math.floor((state.totalEarned / next) * 100));
        dom.levelDisplay.innerHTML = `LVL ${level} <span class="level-bar-wrap"><span class="level-bar-fill" style="width:${pct}%"></span></span> <span class="level-next">${fmt(state.totalEarned)} / ${fmt(next)}</span>`;
    } else {
        dom.levelDisplay.innerHTML = `LVL ${getMaxLevel()} <span class="level-max">✦ MAX</span>`;
    }
}

function updateCardVisibility() {
    const level = getLevel();
    for (const id in upgrades) {
        const card = document.getElementById(id);
        if (!card) continue;
        card.style.display = upgrades[id].unlockLevel <= level ? '' : 'none';
    }
    const world = getWorldUpgrades();
    if (world) {
        for (const id in world) {
            const card = document.getElementById(`world_${id}`);
            if (!card) continue;
            card.style.display = world[id].unlockLevel <= level ? '' : 'none';
        }
    }
}

// ── In-place card text updates (no DOM rebuild) ──
function updateCardText(id, upgradeSet = null) {
    const set    = upgradeSet || upgrades;
    const isWorld = upgradeSet !== null;
    const cardId = isWorld ? `world_${id}` : id;
    const card   = document.getElementById(cardId);
    if (!card) return;
    const u       = set[id];
    const nameEl  = card.querySelector('.card-name');
    const countEl = card.querySelector('.card-count');
    const costEl  = card.querySelector('.card-cost');
    if (nameEl)  nameEl.textContent  = `${u.emoji} ${u.name}`;
    if (countEl) countEl.textContent = u.owned;
    if (costEl)  costEl.textContent  = `🫘 ${fmt(getUpgradeCost(u))}`;
}

function updateCardAffordability() {
    for (const id in upgrades) {
        const card = document.getElementById(id);
        if (!card) continue;
        card.classList.toggle('insufficient-funds', state.beans < getUpgradeCost(upgrades[id]));
    }
    const world = getWorldUpgrades();
    if (world) {
        for (const id in world) {
            const card = document.getElementById(`world_${id}`);
            if (!card) continue;
            card.classList.toggle('insufficient-funds', state.beans < getUpgradeCost(world[id]));
        }
    }
}

function updatePrestigeDisplay() {
    const scalePct = Math.round((prestigeScaling() - 1) * 100);
    const pp       = computePP(state.prestigeCount);
    const perRun   = Math.round(state.prestigeEffects.prestigePerRun * 100);

    if (dom.prestigeDesc) {
        dom.prestigeDesc.innerHTML = `Reset at <strong>level ${getMaxLevel()}</strong> for a permanent <strong>+${perRun}% bean bonus</strong>. Each prestige makes leveling <strong>20% harder</strong>.`;
    }

    if (dom.prestigeInfo) {
        dom.prestigeInfo.textContent = state.prestigeCount > 0
            ? `✦ ${state.prestigeCount} Prestige${state.prestigeCount !== 1 ? 's' : ''} · +${Math.round((getPrestigeMulti() - 1) * 100)}% beans · Levels +${scalePct}% harder · ${pp} PP total`
            : `No prestiges yet. Each prestige resets progress but gives +${perRun}% beans permanently.`;
    }

    // Keep mobile in sync
    const descDst = document.getElementById("prestigeDescMobile");
    if (dom.prestigeDesc && descDst) descDst.innerHTML = dom.prestigeDesc.innerHTML;
    const dstInfo = document.getElementById("prestigeInfoMobile");
    if (dom.prestigeInfo && dstInfo) dstInfo.textContent = dom.prestigeInfo.textContent;
}

// ══════════════════════════════════════════════
//  BUILD UPGRADE CARDS
// ══════════════════════════════════════════════
function buildUpgradeCards() {
    buildUpgradeList('upgradeList', upgrades, false);

    const world = getWorldUpgrades();
    if (dom.worldUpgradeTab) dom.worldUpgradeTab.style.display = world ? '' : 'none';
    if (dom.worldUpgradeList && world) buildUpgradeList('worldUpgradeList', world, true);
}

function buildUpgradeList(containerId, upgradeSet, isWorld) {
    const list = document.getElementById(containerId);
    if (!list) return;
    list.innerHTML = '';
    let i = 0;
    for (const id in upgradeSet) {
        const u      = upgradeSet[id];
        const cardId = isWorld ? `world_${id}` : id;
        const card   = document.createElement('div');
        card.id        = cardId;
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
            <div class="card-cost">🫘 ${fmt(getUpgradeCost(u))}</div>
            <div class="card-stat">${statType}</div>
            <div class="card-tooltip">
                <div class="tooltip-stat">${statType}</div>
                <div class="tooltip-desc">${u.desc}</div>
                <div class="tooltip-unlock">Unlocks at level ${u.unlockLevel}</div>
            </div>
        `;
        card.addEventListener('click', () => buyUpgrade(id, isWorld ? upgradeSet : null));
        list.appendChild(card);
    }
}

// ══════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════
function showToast(title, desc, color = '#4caf50') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-title" style="color:${color}">${title}</span>${desc ? `<span class="toast-desc">${desc}</span>` : ''}`;
    dom.toastContainer.appendChild(toast);
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
    banner.id        = 'announcementBanner';
    banner.className = 'announcement-banner';
    banner.innerHTML = `<span class="announcement-text">📢 ${msg}</span><button class="announcement-close" onclick="this.parentElement.remove()">✕</button>`;
    document.body.appendChild(banner);
}

// ══════════════════════════════════════════════
//  ACHIEVEMENT CHECKS (throttled — only run when dirty)
// ══════════════════════════════════════════════
let achievementsDirty = true;

function markAchievementsDirty() {
    achievementsDirty = true;
}

function checkAchievements() {
    if (!achievementsDirty) return;
    let anyNew = false;
    for (const def of achievementDefs) {
        if (!state.achievements.includes(def.id) && def.check()) {
            state.achievements.push(def.id);
            showToast(`🏆 ${def.label}`, def.desc, '#ffd54f');
            anyNew = true;
        }
    }
    if (anyNew) {
        ls.setJSON("beanAchievements", state.achievements);
        renderAchievements();
    }
    achievementsDirty = false;
}

function renderAchievements() {
    if (!dom.achievementList) return;
    dom.achievementList.innerHTML = '';
    const earned = achievementDefs.filter(d => state.achievements.includes(d.id));
    const locked = achievementDefs.filter(d => !state.achievements.includes(d.id));
    if (dom.achCount) dom.achCount.textContent = `${earned.length} / ${achievementDefs.length}`;
    for (const def of [...earned, ...locked]) {
        const isEarned = state.achievements.includes(def.id);
        const div = document.createElement('div');
        div.className = 'achievement-item' + (isEarned ? ' earned' : '');
        div.innerHTML = `<span class="ach-label">${isEarned ? def.label : '???'}</span><span class="ach-desc">${isEarned ? def.desc : 'Keep playing...'}</span>`;
        dom.achievementList.appendChild(div);
    }
}

// ══════════════════════════════════════════════
//  RANDOM EVENTS
// ══════════════════════════════════════════════
function triggerEvent(def) {
    if (state.activeEvent) return;
    state.activeEvent = def;
    def.onStart();
    showToast(def.title, def.desc, def.color);
    updateBPSDisplay();

    if (def.duration > 0) {
        dom.eventBar.style.display = 'flex';
        dom.eventBar.querySelector('.event-label').textContent = def.title;
        let remaining = def.duration;
        const tick = setInterval(() => {
            remaining -= 100;
            dom.eventBar.querySelector('.event-fill').style.width = ((remaining / def.duration) * 100) + '%';
            if (remaining <= 0) {
                clearInterval(tick);
                dom.eventBar.style.display = 'none';
                def.onEnd();
                state.activeEvent = null;
                updateBPSDisplay();
            }
        }, 100);
    } else {
        state.activeEvent = null;
    }
}

function scheduleEvent() {
    const base  = 60000 + Math.random() * 90000;
    const delay = base * (state.prestigeEffects.eventSpeedMult || 1);
    setTimeout(() => {
        triggerEvent(eventDefs[Math.floor(Math.random() * eventDefs.length)]);
        scheduleEvent();
    }, delay);
}

// ══════════════════════════════════════════════
//  ANTI-CHEAT
// ══════════════════════════════════════════════
let lastClick = 0;
const CLICK_COOLDOWN = 50;
const clickIntervals = [];
let lastClickTime    = 0;
let autoclickWarnings = 0;
let clickFrozen      = false;

function detectAutoclicker() {
    if (clickIntervals.length < 10) return false;
    const mean     = clickIntervals.reduce((a, b) => a + b, 0) / clickIntervals.length;
    const variance = clickIntervals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / clickIntervals.length;
    const stdDev   = Math.sqrt(variance);

    if (stdDev < 5 && mean < 50) return true;
    if (stdDev < 3 && mean < 150) return true;
    return false;
}

function punishAutoclicker() {
    autoclickWarnings++;
    const username = state.currentUser ? state.currentUser.displayName : 'unknown';
    const oldBeans = state.beans;
    state.beans = 0;
    persistCore();
    updateBeanDisplay();

    reportCheat(username, `Autoclicker detected — wiped ${fmt(oldBeans)} beans (warning #${autoclickWarnings})`);
    showToast('🤖 Autoclicker Detected', `Lost ${fmt(oldBeans)} beans. Click yourself!`, '#ef5350');

    if (dom.cheatNotice) {
        dom.cheatNotice.textContent = `⚠️ Autoclicker detected ${autoclickWarnings} time${autoclickWarnings !== 1 ? 's' : ''}. Beans wiped.`;
        dom.cheatNotice.style.display = 'block';
    }

    clickFrozen = true;
    setTimeout(() => { clickFrozen = false; }, 10000);
    clickIntervals.length = 0;
}

// ══════════════════════════════════════════════
//  CLICK HANDLER
// ══════════════════════════════════════════════
function beanclicker() {
    if (clickFrozen) return;

    const now = Date.now();
    if (now - lastClick < CLICK_COOLDOWN) return;

    if (lastClickTime > 0) {
        const interval = now - lastClickTime;
        if (interval < 500) {
            clickIntervals.push(interval);
            if (clickIntervals.length > 10) clickIntervals.shift();
        }
    }
    lastClickTime = now;
    lastClick     = now;

    if (detectAutoclicker()) {
        punishAutoclicker();
        return;
    }

    const frenzy     = state.activeEvent && state.activeEvent.id === 'frenzy' ? state.eventMultiplier : 1;
    const isCrit     = state.prestigeEffects.critChance > 0 && Math.random() < state.prestigeEffects.critChance;
    const critMulti  = isCrit ? 10 : 1;
    const clicktotal = Math.floor(calcBPC() * getPrestigeMulti() * frenzy * critMulti);

    state.beans     += clicktotal;
    state.totalEarned += clicktotal;
    state.totalClicks++;

    updateBeanDisplay();
    persistCore();

    playClickSound();
    spawnFloatText(isCrit ? `💥 +${fmt(clicktotal)}` : `+${fmt(clicktotal)}`);

    dom.beanEl.classList.remove('bean-clicked');
    void dom.beanEl.offsetWidth;
    dom.beanEl.classList.add('bean-clicked');

    updateLevelDisplay();
    updateCardVisibility();
    updateCardAffordability();
    markAchievementsDirty();
    checkAchievements();
}

// ══════════════════════════════════════════════
//  BPS TICK (throttled heavy operations)
// ══════════════════════════════════════════════
let tickCount = 0;

function bpsTick() {
    const multiplier = state.activeEvent && (state.activeEvent.id === 'rain' || state.activeEvent.id === 'harvest') ? state.eventMultiplier : 1;
    const total = Math.floor(calcBPS() * getPrestigeMulti() * multiplier);

    if (total > 0) {
        state.beans     += total;
        state.totalEarned += total;
        updateBeanDisplay();
        persistCore();
    }

    updateBPSDisplay();
    tickCount++;

    // Heavy operations: only every 3 ticks (3 seconds)
    if (tickCount % 3 === 0) {
        updateLevelDisplay();
        updateCardVisibility();
        updateCardAffordability();
        markAchievementsDirty();
        checkAchievements();
    }
}

// ── Float text ──
function spawnFloatText(text) {
    const el = document.createElement("div");
    el.textContent = text;
    el.className   = "float-text";
    document.body.appendChild(el);
    const rect = dom.beanPic.getBoundingClientRect();
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

// ══════════════════════════════════════════════
//  BUY UPGRADE
// ══════════════════════════════════════════════
function buyUpgrade(id, upgradeSet = null) {
    const set  = upgradeSet || upgrades;
    const u    = set[id];
    const cost = getUpgradeCost(u);
    if (state.beans < cost) {
        flashNoFunds(upgradeSet ? `world_${id}` : id);
        return;
    }
    state.beans -= cost;
    u.owned++;
    persistCore();
    ls.set(upgradeSet ? `wupg_${state.activeThemeId}_${id}` : `upg_${id}`, u.owned);

    updateCardText(id, upgradeSet);
    updateBeanDisplay();
    updateBPSDisplay();
    updateLevelDisplay();
    updateCardVisibility();
    updateCardAffordability();
    markAchievementsDirty();
    checkAchievements();
}

// ══════════════════════════════════════════════
//  PRESTIGE
// ══════════════════════════════════════════════
function prestige() {
    if (getLevel() < getMaxLevel()) {
        showToast('⚠️ Not Yet', `Reach level ${getMaxLevel()} to prestige.`, '#ef5350');
        return;
    }
    const perRun = Math.round(state.prestigeEffects.prestigePerRun * 100);
    if (!confirm(`Prestige? Everything resets but you gain a permanent +${perRun}% bean multiplier.\nCurrent bonus: +${Math.round((getPrestigeMulti() - 1) * 100)}%`)) return;

    state.prestigeCount++;

    const keepCount = state.prestigeEffects.keepUpgrades;
    const keptOwned = {};
    if (keepCount > 0) {
        for (const id in upgrades) keptOwned[id] = Math.min(upgrades[id].owned, keepCount);
    }

    // Head Start: scales with prestige count and level
    // Tier 1: 1K * prestiges, Tier 2: 5K * prestiges, etc.
    const headStartTiers = [0, 1000, 5000, 25000, 100000, 500000];
    const hsLevel = state.prestigeEffects.headStartLevel;
    const startBeans = hsLevel > 0 ? (headStartTiers[hsLevel] || 0) * state.prestigeCount : 0;

    state.beans       = startBeans;
    state.totalEarned = 0;
    state.totalClicks = 0;

    for (const id in upgrades) {
        upgrades[id].owned = keepCount > 0 ? (keptOwned[id] || 0) : 0;
        ls.set(`upg_${id}`, upgrades[id].owned);
    }

    for (const themeId in worldUpgrades) {
        const wset = worldUpgrades[themeId];
        for (const id in wset) {
            wset[id].owned = 0;
            ls.set(`wupg_${themeId}_${id}`, 0);
        }
    }

    persistCore();
    state.prestigeEffects = getPrestigeEffects();

    const unlocked = getUnlockedThemes(state.prestigeCount);
    const newTheme = unlocked[unlocked.length - 1];
    if (newTheme.id !== state.activeThemeId) {
        showToast(`🎨 New Theme!`, `${newTheme.emoji} ${newTheme.name} unlocked!`, newTheme.id === 'void' ? '#9c27b0' : '#ce93d8');
        applyTheme(newTheme.id);
    }

    showToast('🔁 Prestige!', `+${perRun}% bonus. Total: +${Math.round((getPrestigeMulti() - 1) * 100)}%`, '#ce93d8');
    updateBeanDisplay();
    updateBPSDisplay();
    updateLevelDisplay();
    updateCardVisibility();
    updatePrestigeDisplay();
    buildPrestigeShop();
    buildThemeSelector();
    buildUpgradeCards();
    for (const id in upgrades) updateCardText(id);
    updateCardAffordability();
    markAchievementsDirty();
    checkAchievements();
    saveToCloud();
}

// ══════════════════════════════════════════════
//  TABS
// ══════════════════════════════════════════════
let leaderboardInterval = null;

function switchTab(tabName, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');

    if (tabName === 'leaderboard') {
        loadLeaderboard();
        if (!leaderboardInterval) {
            leaderboardInterval = setInterval(loadLeaderboard, 60000);
        }
    } else {
        if (leaderboardInterval) {
            clearInterval(leaderboardInterval);
            leaderboardInterval = null;
        }
    }
    if (tabName === 'pshop') { buildPrestigeShop(); buildThemeSelector(); }
}

// ══════════════════════════════════════════════
//  LEADERBOARD
// ══════════════════════════════════════════════
function saveUsername() {
    // No-op — username is set at signup via Firebase Auth displayName
}

function showUsernameDisplay(name) {
    dom.usernameSection.style.display = 'none';
    dom.currentUserEl.style.display = 'block';
    dom.currentUserEl.innerHTML = `<span class="current-user-name">✦ ${escapeHtml(name)}</span>`;
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let lastLBSubmit = 0;
async function loadLeaderboard() {
    dom.leaderboardList.innerHTML = '<div class="lb-loading">loading...</div>';
    const now = Date.now();
    if (state.currentUser && now - lastLBSubmit > 30000) {
        await submitScore(state.currentUser.uid, state.currentUser.displayName, getLevel(), state.totalEarned, state.prestigeCount);
        lastLBSubmit = now;
    }
    const entries = await fetchLeaderboard();
    if (entries.length === 0) {
        dom.leaderboardList.innerHTML = '<div class="lb-loading">No entries yet.</div>';
        return;
    }
    dom.leaderboardList.innerHTML = '';
    entries.forEach((e, i) => {
        const div  = document.createElement('div');
        const isMe = state.currentUser && state.currentUser.displayName === e.username;
        div.className = 'lb-entry' + (isMe ? ' lb-me' : '');

        const rank = document.createElement('span');
        rank.className   = 'lb-rank';
        rank.textContent = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

        const name = document.createElement('span');
        name.className   = 'lb-name';
        name.textContent = e.username;

        const level = document.createElement('span');
        level.className   = 'lb-level';
        level.textContent = `LVL ${e.level}`;

        div.appendChild(rank);
        div.appendChild(name);
        div.appendChild(level);

        if (e.prestigeCount > 0) {
            const p = document.createElement('span');
            p.className   = 'lb-prestige';
            p.textContent = `✦${e.prestigeCount}`;
            div.appendChild(p);
        }
        dom.leaderboardList.appendChild(div);
    });
}

// ══════════════════════════════════════════════
//  CLOUD SAVE / LOAD
// ══════════════════════════════════════════════
async function saveToCloud() {
    if (!state.currentUser) return;

    const save = {
        beans:         state.beans,
        totalEarned:   state.totalEarned,
        totalClicks:   state.totalClicks,
        prestigeCount: state.prestigeCount,
        beanTheme:     state.activeThemeId,
        achievements:  state.achievements,
        upgrades:      {},
        worldUpgrades: {},
        prestigeShop:  {},
    };

    for (const id in upgrades) save.upgrades[id] = upgrades[id].owned;
    for (const themeId in worldUpgrades) {
        save.worldUpgrades[themeId] = {};
        for (const id in worldUpgrades[themeId]) {
            save.worldUpgrades[themeId][id] = worldUpgrades[themeId][id].owned;
        }
    }
    for (const id in prestigeUpgrades) save.prestigeShop[id] = prestigeUpgrades[id].level;

    await saveGameState(state.currentUser.uid, save);
}

async function loadFromCloud(userId) {
    const save = await loadGameState(userId);
    if (!save) return; // no cloud save

    // Safe number loader — never returns NaN
    const safeNum = (val, fallback = 0) => {
        const n = Number(val);
        return isNaN(n) ? fallback : n;
    };

    state.beans         = safeNum(save.beans,         ls.get("beans"));
    state.totalEarned   = safeNum(save.totalEarned,   ls.get("totalEarned"));
    state.totalClicks   = safeNum(save.totalClicks,   ls.get("totalClicks"));
    state.prestigeCount = safeNum(save.prestigeCount, ls.get("prestigeCount"));
    state.activeThemeId = save.beanTheme || ls.str("beanTheme", "default");
    state.achievements  = Array.isArray(save.achievements) ? save.achievements : ls.getJSON("beanAchievements", []);

    // Support new nested format and old flat format
    if (save.upgrades) {
        for (const id in upgrades) upgrades[id].owned = safeNum(save.upgrades[id]);
    } else {
        for (const id in upgrades) upgrades[id].owned = safeNum(save[`upg_${id}`]);
    }

    if (save.worldUpgrades) {
        for (const themeId in worldUpgrades) {
            for (const id in worldUpgrades[themeId]) {
                worldUpgrades[themeId][id].owned = safeNum(save.worldUpgrades[themeId]?.[id]);
            }
        }
    } else {
        for (const themeId in worldUpgrades) {
            for (const id in worldUpgrades[themeId]) {
                worldUpgrades[themeId][id].owned = safeNum(save[`wupg_${themeId}_${id}`]);
            }
        }
    }

    // Prestige shop — old upgrade IDs that don't exist anymore just get ignored
    if (save.prestigeShop) {
        for (const id in prestigeUpgrades) prestigeUpgrades[id].level = safeNum(save.prestigeShop[id]);
    } else {
        // Old flat format: only load if the key matches a current upgrade
        for (const id in prestigeUpgrades) prestigeUpgrades[id].level = safeNum(save[`pshop_${id}`]);
    }

    persistCore();
}

// ══════════════════════════════════════════════
//  DEV RESET
// ══════════════════════════════════════════════
function devReset() { localStorage.clear(); location.reload(); }

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
function Initialize() {
    initAudioPool();

    onAuthReady(async (user) => {
        console.log('onAuthReady fired', user?.uid);
        if (!user) {
            if (dom.authOverlay) dom.authOverlay.classList.remove('hidden');
            return;
        }

        if (state.gameInitialized) return;
        state.gameInitialized = true;
        state.currentUser = user;

        if (dom.authOverlay) dom.authOverlay.classList.add('hidden');
        showUsernameDisplay(user.displayName || user.email);

        await loadFromCloud(user.uid);
        state.prestigeEffects = getPrestigeEffects();

        buildUpgradeCards();
        updateBeanDisplay();
        updateBPSDisplay();
        updateLevelDisplay();
        updateCardVisibility();
        updateCardAffordability();
        updatePrestigeDisplay();
        renderAchievements();
        buildPrestigeShop();
        buildThemeSelector();
        applyTheme(state.activeThemeId);
        scheduleEvent();

        // BPS tick
        setInterval(bpsTick, 1000);

        // Cloud save every 30s
        setInterval(saveToCloud, 30000);

        watchAnnouncement(msg => showBanner(msg));
        watchGlobalEvent(eventId => {
            const def = eventDefs.find(e => e.id === eventId);
            if (def) triggerEvent(def);
        });

        // Input handling
        if ('ontouchstart' in window) {
            dom.beanPic.addEventListener("touchstart", (e) => { e.preventDefault(); beanclicker(); }, { passive: false });
        } else {
            dom.beanPic.addEventListener("click", beanclicker);
        }
        dom.beanEl.addEventListener('animationend', () => dom.beanEl.classList.remove('bean-clicked'));

        // Prevent zoom/context menu
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
        document.addEventListener('keydown', e => { if (e.ctrlKey && ['+','-','='].includes(e.key)) e.preventDefault(); });
        document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
        document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
    });
}

async function handleLogout() {
    await logOut();
    location.reload();
}

// ── Expose globals ──
window.handleLogout    = handleLogout;
window.switchTab       = switchTab;
window.loadLeaderboard = loadLeaderboard;
window.devReset        = devReset;
window.prestige        = prestige;
window.saveUsername     = saveUsername;

Initialize();