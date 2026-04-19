const CACHE = 'njk-v1';
const SHELL = [
    './',
    './index.html',
    './style.css',
    './manifest.webmanifest',
    './src/main.js',
    './src/constants.js',
    './src/engine.js',
    './src/renderer.js',
    './src/background.js',
    './src/map_data.js',
    './src/map_loader.js',
    './src/stage_themes.js',
    './assets/KERISKEDU_B.otf',
    './assets/icons/icon.svg',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => null)
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // Apps Script 등 외부 요청은 패스

    e.respondWith(
        caches.match(req).then(cached => {
            const fetchPromise = fetch(req).then(net => {
                if (net && net.ok) {
                    const clone = net.clone();
                    caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
                }
                return net;
            }).catch(() => cached);
            return cached || fetchPromise;
        })
    );
});
