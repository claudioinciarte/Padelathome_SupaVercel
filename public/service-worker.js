const CACHE_NAME = 'padelathome-cache-v2';
// Lista de archivos base para que la app cargue offline
const urlsToCache = [
  '/',
  '/login.html',
  '/dashboard.html',
  '/admin.html',
  '/style.css',
  '/main.js',
  '/login.js',
  '/dashboard.js',
  '/admin.js',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
];

// Evento 'install': guarda los archivos base en la caché.
// Usamos Promise.allSettled para que un fallo de un recurso no bloquee la instalación.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(urlsToCache.map(url => cache.add(url))))
  );
  self.skipWaiting();
});

// Evento 'activate': limpia cachés antiguas y toma el control de las pestañas abiertas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Evento 'fetch': SOLO interceptamos peticiones del MISMO ORIGEN y que no sean de la API.
// Las peticiones cross-origin (CDN de Tailwind, fuentes, Supabase...) pasan directas
// al navegador sin pasar por el service worker.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignora peticiones a la API (siempre red) y a otros orígenes (CDN, etc.)
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET') return;

  // Estrategia "Network First" con fallback a caché:
  // siempre intentamos la versión más reciente (evita UI desactualizada tras un deploy)
  // y si no hay red, servimos lo cacheado (modo offline de la PWA).
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
