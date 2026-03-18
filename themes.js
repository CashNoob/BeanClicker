// themes.js — Prestige world themes for Bean Clicker

export const themes = [
    {
        id: 'default',
        name: 'Bean World',
        emoji: '🫘',
        beanLabel: 'beans',
        unlockPrestige: 0,
        bodyClass: 'theme-default',
        desc: 'Where it all began.',
    },
    {
        id: 'space',
        name: 'Space Beans',
        emoji: '🌌',
        beanLabel: 'cosmic beans',
        unlockPrestige: 1,
        bodyClass: 'theme-space',
        desc: 'Beyond the atmosphere, the beans are infinite.',
    },
    {
        id: 'lava',
        name: 'Lava Beans',
        emoji: '🌋',
        beanLabel: 'magma beans',
        unlockPrestige: 2,
        bodyClass: 'theme-lava',
        desc: 'Forged in the earth\'s core. Extremely spicy.',
    },
    {
        id: 'ice',
        name: 'Frost Beans',
        emoji: '❄️',
        beanLabel: 'frost beans',
        unlockPrestige: 3,
        bodyClass: 'theme-ice',
        desc: 'Crystallized in the tundra. Cold but plentiful.',
    },
    {
        id: 'golden',
        name: 'Golden Beans',
        emoji: '✨',
        beanLabel: 'gold beans',
        unlockPrestige: 4,
        bodyClass: 'theme-golden',
        desc: 'Worth their weight. Literally.',
    },
    {
        id: 'void',
        name: 'Void Beans',
        emoji: '🕳️',
        beanLabel: 'void beans',
        unlockPrestige: 5,
        bodyClass: 'theme-void',
        desc: 'They should not exist. They do.',
    },
];

// Returns the best theme the player has unlocked and selected
// activeThemeId is stored in localStorage as 'beanTheme'
export function getActiveTheme(prestigeCount, activeThemeId) {
    const unlocked = themes.filter(t => t.unlockPrestige <= prestigeCount);
    return unlocked.find(t => t.id === activeThemeId) || unlocked[unlocked.length - 1];
}

export function getUnlockedThemes(prestigeCount) {
    return themes.filter(t => t.unlockPrestige <= prestigeCount);
}