const CACHE_NAME = 'nostalgia-static-v1';

const APP_SHELL = [
  '/style.css',
  '/favicon.svg',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/scripts/nav.js',
  '/scripts/auth-shared.js'
];

// Розширення, які кешуємо cache-first. data/*.json свідомо НЕ входить —
// ці файли оновлюються скрейпінгом і мають завжди йти в мережу.
const STATIC_EXTENSIONS = /\.(?:css|js|png|jpg|jpeg|svg|webp|woff2?|ttf)(?:\?.*)?$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Лише GET, лише свій origin — API воркера, Discord, CDN Chart.js йдуть
  // напряму в мережу без втручання SW.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (!STATIC_EXTENSIONS.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
