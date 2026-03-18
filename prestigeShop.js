// prestigeShop.js — Persistent prestige upgrades for Bean Clicker
// These are bought with Prestige Points (PP) and NEVER reset on prestige.

export const prestigeUpgrades = {
    headstart: {
        name: 'Head Start',
        emoji: '🚀',
        desc: 'Begin each prestige with 500 free beans.',
        cost: 1,
        maxLevel: 5,
        level: 0,
        effect: (level) => ({ startingBeans: 500 * level }),
        effectDesc: (level) => `Start with ${500 * level} beans`,
    },
    keeperOfSeeds: {
        name: 'Keeper of Seeds',
        emoji: '🌱',
        desc: 'Keep 1 of each upgrade you owned when prestiging (per level).',
        cost: 3,
        maxLevel: 3,
        level: 0,
        effect: (level) => ({ keepUpgrades: level }),
        effectDesc: (level) => `Keep ${level} of each upgrade on prestige`,
    },
    beanMemory: {
        name: 'Bean Memory',
        emoji: '🧠',
        desc: 'BPS starts at 10% of your previous best BPS (per level).',
        cost: 2,
        maxLevel: 5,
        level: 0,
        effect: (level) => ({ bpsRetain: 0.10 * level }),
        effectDesc: (level) => `Retain ${level * 10}% of previous best BPS`,
    },
    clickPower: {
        name: 'Seasoned Hands',
        emoji: '🖐️',
        desc: '+5 flat bonus beans per click, permanently.',
        cost: 2,
        maxLevel: 10,
        level: 0,
        effect: (level) => ({ flatBPC: 5 * level }),
        effectDesc: (level) => `+${5 * level} flat BPC always`,
    },
    eventLuck: {
        name: 'Lucky Beans',
        emoji: '🍀',
        desc: 'Random events happen 20% more often per level.',
        cost: 2,
        maxLevel: 3,
        level: 0,
        effect: (level) => ({ eventSpeedMult: 1 - (0.20 * level) }),
        effectDesc: (level) => `Events ${level * 20}% more frequent`,
    },
    prestigeBonus: {
        name: 'Prestige Rush',
        emoji: '🔁',
        desc: 'Each prestige gives +15% beans instead of +10%.',
        cost: 5,
        maxLevel: 1,
        level: 0,
        effect: (level) => ({ prestigePerRun: level ? 0.15 : 0.10 }),
        effectDesc: (level) => level ? '+15% per prestige (upgraded)' : '+10% per prestige (default)',
    },
    beanShield: {
        name: 'Bean Shield',
        emoji: '🛡️',
        desc: 'Blight events steal 5% less beans per level.',
        cost: 1,
        maxLevel: 3,
        level: 0,
        effect: (level) => ({ blightReduction: 0.05 * level }),
        effectDesc: (level) => `Blight only steals ${15 - level * 5}% beans`,
    },
    themeUnlocker: {
        name: 'Dimensional Key',
        emoji: '🗝️',
        desc: 'Unlocks the Theme Selector panel.',
        cost: 1,
        maxLevel: 1,
        level: 0,
        effect: () => ({ themeSelector: true }),
        effectDesc: () => 'Theme panel unlocked',
    },
};

// Compute total PP earned from prestige count
export function computePP(prestigeCount) {
    if (prestigeCount <= 0) return 0;
    // 1 PP for first prestige, scaling up
    let pp = 0;
    for (let i = 1; i <= prestigeCount; i++) {
        pp += Math.floor(1 + (i - 1) * 0.5);
    }
    return pp;
}

// Compute spent PP from current upgrade levels
export function computeSpentPP() {
    let spent = 0;
    for (const id in prestigeUpgrades) {
        const u = prestigeUpgrades[id];
        // Cost increases each level: cost * level for total spent
        for (let i = 0; i < u.level; i++) {
            spent += u.cost + i;
        }
    }
    return spent;
}

export function getAvailablePP(prestigeCount) {
    return computePP(prestigeCount) - computeSpentPP();
}

// Get combined effects from all purchased prestige upgrades
export function getPrestigeEffects() {
    const effects = {
        startingBeans: 0,
        keepUpgrades: 0,
        bpsRetain: 0,
        flatBPC: 0,
        eventSpeedMult: 1,
        prestigePerRun: 0.10,
        blightReduction: 0,
        themeSelector: false,
    };
    for (const id in prestigeUpgrades) {
        const u = prestigeUpgrades[id];
        if (u.level > 0) {
            const fx = u.effect(u.level);
            for (const key in fx) {
                if (key === 'eventSpeedMult') {
                    effects[key] = Math.min(effects[key], fx[key]); // take the lowest (fastest)
                } else if (key === 'prestigePerRun') {
                    effects[key] = fx[key];
                } else if (key === 'themeSelector') {
                    effects[key] = fx[key];
                } else {
                    effects[key] += fx[key];
                }
            }
        }
    }
    return effects;
}