const CACHE_NAME = 'ridgebox-v3';
const ASSETS_TO_CACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))));
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    // Never cache API calls
    if (event.request.url.includes('/api/')) return;
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
});
