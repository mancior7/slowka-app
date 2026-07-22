const CACHE_NAME = "slowka-v1";
const STATIC_ASSETS = [
  "./",
  "index.html",
  "manifest.json",
  "css/style.css",
  "js/storage.js",
  "js/srs.js",
  "js/parser.js",
  "js/imagesplit.js",
  "js/ocr.js",
  "js/quiz.js",
  "js/stats.js",
  "js/app.js",
  "icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Sieć najpierw (żeby zawsze mieć świeżą wersję gdy jest internet), cache jako
  // zapasowa opcja offline. Wersja odwrotna (cache-first) potrafi latami serwować
  // stare pliki po aktualizacji kodu.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
