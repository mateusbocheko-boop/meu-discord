// VOX SERVICE WORKER - AUTO CACHE PURGE
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.map(k => caches.delete(k)));
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    // Sempre busca da rede diretamente (Network Only)
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
