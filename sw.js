const CACHE_NAME = "slowka-v5";
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
  "js/speech.js",
  "js/stats.js",
  "js/app.js",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];

// Wymusza pominięcie zwykłego cache'u HTTP przeglądarki (nie tylko Cache Storage) -
// bez tego zwykły fetch() potrafi dostać stary plik z dysku, mimo że logika poniżej
// próbuje zawsze najpierw iść do sieci.
function freshFetch(requestOrUrl) {
  const req = requestOrUrl instanceof Request ? requestOrUrl : new Request(requestOrUrl);
  return fetch(new Request(req, { cache: "no-store" }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.all(STATIC_ASSETS.map((url) => freshFetch(url).then((res) => cache.put(url, res)))))
  );
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
    freshFetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
