const CACHE_NAME = 'ridgebox-v7';
const ASSETS_TO_CACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    // Force delete ALL old caches
    event.waitUntil(
        caches.keys().then(names => Promise.all(
            names.filter(n => n !== CACHE_NAME).map(n => {
                console.log('Deleting old cache:', n);
                return caches.delete(n);
            })
        ))
    );
    self.clients.claim();
});

// Network-first strategy for HTML, cache-first for static assets
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    // Never cache API calls
    if (event.request.url.includes('/api/')) return;

    // For HTML pages: network-first to always get latest version
    if (event.request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request).then(r => r || new Response('Offline', { status: 503 })))
        );
        return;
    }

    // For other assets: cache-first
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
