// prestigeShop.js — Prestige upgrades for Bean Clicker
// Bought with Prestige Points (PP) and NEVER reset on prestige.

export const prestigeUpgrades = {

    // ── CORE MULTIPLIERS (always useful) ──

    beanBlessing: {
        name: 'Bean Blessing',
        emoji: '✨',
        desc: 'All bean income multiplied. The most important upgrade.',
        cost: 2,
        maxLevel: 10,
        level: 0,
        effect: (level) => ({ globalMulti: 1 + (level * 0.25) }),
        effectDesc: (level) => level ? `x${(1 + level * 0.25).toFixed(2)} all beans` : 'No bonus yet',
    },

    prestigeRush: {
        name: 'Prestige Rush',
        emoji: '🔁',
        desc: 'Each prestige gives a bigger permanent bonus.',
        cost: 3,
        maxLevel: 5,
        level: 0,
        effect: (level) => ({ prestigePerRun: 0.10 + (level * 0.05) }),
        effectDesc: (level) => `+${10 + level * 5}% per prestige`,
    },

    clickForce: {
        name: 'Click Force',
        emoji: '👊',
        desc: 'Multiply all click income. Scales with your BPC.',
        cost: 2,
        maxLevel: 8,
        level: 0,
        effect: (level) => ({ clickMulti: 1 + (level * 0.3) }),
        effectDesc: (level) => level ? `x${(1 + level * 0.3).toFixed(1)} click power` : 'No bonus yet',
    },

    idleEngine: {
        name: 'Idle Engine',
        emoji: '⚙️',
        desc: 'Multiply all BPS income. Beans while you sleep.',
        cost: 2,
        maxLevel: 8,
        level: 0,
        effect: (level) => ({ bpsMulti: 1 + (level * 0.3) }),
        effectDesc: (level) => level ? `x${(1 + level * 0.3).toFixed(1)} BPS` : 'No bonus yet',
    },

    // ── PRESTIGE QOL (make each run smoother) ──

    headStart: {
        name: 'Head Start',
        emoji: '🚀',
        desc: 'Start each run with beans. Scales with prestige count.',
        cost: 1,
        maxLevel: 5,
        level: 0,
        effect: (level) => ({ headStartLevel: level }),
        effectDesc: (level) => level ? `Start with beans (tier ${level})` : 'No head start',
    },

    keeperOfSeeds: {
        name: 'Keeper of Seeds',
        emoji: '🌱',
        desc: 'Keep some of each upgrade when you prestige.',
        cost: 3,
        maxLevel: 5,
        level: 0,
        effect: (level) => ({ keepUpgrades: level * 2 }),
        effectDesc: (level) => `Keep ${level * 2} of each upgrade`,
    },

    cheapskate: {
        name: 'Cheapskate',
        emoji: '💰',
        desc: 'All upgrades cost less. Stacks multiplicatively.',
        cost: 2,
        maxLevel: 5,
        level: 0,
        effect: (level) => ({ costReduction: Math.pow(0.92, level) }),
        effectDesc: (level) => level ? `Upgrades cost ${Math.round((1 - Math.pow(0.92, level)) * 100)}% less` : 'No discount',
    },

    // ── EVENT / UTILITY ──

    eventLuck: {
        name: 'Lucky Beans',
        emoji: '🍀',
        desc: 'Events happen more often and bad events are weaker.',
        cost: 1,
        maxLevel: 5,
        level: 0,
        effect: (level) => ({
            eventSpeedMult: Math.max(0.3, 1 - (0.15 * level)),
            blightReduction: 0.04 * level,
        }),
        effectDesc: (level) => level
            ? `Events ${level * 15}% faster, blight -${level * 4}%`
            : 'No event bonus',
    },

    goldenTouch: {
        name: 'Golden Touch',
        emoji: '👑',
        desc: 'Chance for clicks to give 10x beans.',
        cost: 3,
        maxLevel: 5,
        level: 0,
        effect: (level) => ({ critChance: 0.04 * level }),
        effectDesc: (level) => level ? `${level * 4}% chance for 10x click` : 'No crit chance',
    },
};

// ── PP EARNED ──
// 1 PP first prestige, scales up: 1, 1, 2, 2, 3, 3, 4 ...
export function computePP(prestigeCount) {
    if (prestigeCount <= 0) return 0;
    let pp = 0;
    for (let i = 1; i <= prestigeCount; i++) {
        pp += Math.floor(1 + (i - 1) * 0.5);
    }
    return pp;
}

// ── PP SPENT ──
export function computeSpentPP() {
    let spent = 0;
    for (const id in prestigeUpgrades) {
        const u = prestigeUpgrades[id];
        for (let i = 0; i < u.level; i++) {
            spent += u.cost + i;
        }
    }
    return spent;
}

export function getAvailablePP(prestigeCount) {
    return computePP(prestigeCount) - computeSpentPP();
}

// ── COMBINED EFFECTS ──
export function getPrestigeEffects() {
    const effects = {
        globalMulti:    1,
        clickMulti:     1,
        bpsMulti:       1,
        prestigePerRun: 0.10,
        headStartLevel: 0,
        keepUpgrades:   0,
        costReduction:  1,
        eventSpeedMult: 1,
        blightReduction:0,
        critChance:     0,
    };
    for (const id in prestigeUpgrades) {
        const u = prestigeUpgrades[id];
        if (u.level > 0) {
            const fx = u.effect(u.level);
            for (const key in fx) {
                if (key === 'eventSpeedMult' || key === 'costReduction') {
                    effects[key] = Math.min(effects[key], fx[key]);
                } else if (key === 'prestigePerRun') {
                    effects[key] = fx[key];
                } else if (key === 'globalMulti' || key === 'clickMulti' || key === 'bpsMulti') {
                    effects[key] = fx[key];
                } else {
                    effects[key] += fx[key];
                }
            }
        }
    }
    return effects;
}