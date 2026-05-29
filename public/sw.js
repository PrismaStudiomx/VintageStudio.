// 1. Cambiamos la versión a 'v2'. Esto le avisa al celular que hay código nuevo.
const CACHE_NAME = 'prisma-cache-v2';
const assets = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  // CORRECCIÓN CLAVE: Fuerza al nuevo Service Worker a activarse de inmediato 
  // sin esperar a que el usuario cierre la app.
  self.skipWaiting();
  
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(assets)));
});

// BLOQUE NUEVO: Este evento se activa en cuanto subes el archivo.
// Busca memorias viejas (como 'prisma-cache-v1') y las destruye de raíz.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // Si el caché del teléfono es diferente al nuevo 'prisma-cache-v2', se elimina
          if (cache !== CACHE_NAME) {
            console.log('Borrando caché antiguo corrupto:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Toma el control de la aplicación inmediatamente
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});