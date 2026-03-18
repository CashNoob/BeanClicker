const CACHE_NAME = 'bean-clicker-v1';

const ASSETS = [
    './',
    './index.html',
    './style.css',
    './tooltips.css',
    './main.js',
    './upgrades.js',
    './firebase.js',
    './bean.png',
    './bean.m4a',
    './icon.png',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;800&display=swap',
];

// Install — cache all assets
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — serve from cache, fall back to network
self.addEventListener('fetch', e => {
    // Skip firebase/firestore requests — those need network
    if (e.request.url.includes('firestore') ||
        e.request.url.includes('firebase') ||
        e.request.url.includes('googleapis.com/firestore')) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then(cached => {
            return cached || fetch(e.request).catch(() => {
                if (e.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});