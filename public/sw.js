const CACHE_NAME = 'prisma-cache-v3';
const assets = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(assets)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 🔥 ESTRATEGIA BLINDADA: NETWORK-FIRST
self.addEventListener('fetch', (e) => {
  // Solo aplicamos esto a peticiones normales (GET)
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Si internet funciona, guardamos una copia fresca y mostramos la página real
        if (networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // 📉 SI NO HAY INTERNET: El celular rescata la app del caché automáticamente
        return caches.match(e.request);
      })
  );
});