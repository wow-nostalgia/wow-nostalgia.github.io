// Версію піднімати щоразу, коли треба примусово скинути кеш у всіх
// користувачів: activate нижче видаляє всі кеші з іншим імʼям.
const CACHE_NAME = 'nostalgia-static-v2';

const APP_SHELL = [
  '/style.css',
  '/favicon.svg',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/scripts/nav.js',
  '/scripts/auth-shared.js'
];

// Розширення, які кешуємо. data/*.json свідомо НЕ входить — ці файли
// оновлюються скрейпінгом і мають завжди йти в мережу.
const STATIC_EXTENSIONS = /\.(?:css|js|png|jpg|jpeg|svg|webp|woff2?|ttf|mp3|ogg|wav)(?:\?.*)?$/;

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

  // Range-запити (їх робить <audio>/new Audio для mp3) віддають 206 Partial
  // Content, а Cache API такі відповіді класти не вміє. Пропускаємо їх повз
  // SW - хай браузер сам говорить з мережею.
  if (request.headers.has('range')) return;

  // stale-while-revalidate: віддаємо кеш одразу (швидко + офлайн), але
  // паралельно завжди йдемо в мережу й оновлюємо запис. Попередній
  // cache-first не ревалідував ніколи, тож одна стара відповідь у кеші
  // (напр. відповідь CDN під час деплою) залишалась там назавжди, і
  // кеш-бастинг через ?v= її не пробивав.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then(async (response) => {
        // Тільки повні відповіді: 206 Partial Content Cache API не приймає й
        // кидає TypeError. І сам запис у кеш не має валити відповідь -
        // сторінці важливо отримати ресурс, кешування тут другорядне.
        if (response.status === 200) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          } catch {
            // Квота вичерпана, приватний режим тощо - мовчки ігноруємо.
          }
        }
        return response;
      });

      // Коли віддаємо з кеша, respondWith мережу вже не чекає — тримаємо
      // воркера живим через waitUntil, інакше його можуть вимкнути до
      // того, як оновлений запис ляже в кеш. Відмова мережі (офлайн) тут
      // не критична: користувач уже отримав відповідь із кеша.
      if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
      }

      return network;
    })
  );
});
