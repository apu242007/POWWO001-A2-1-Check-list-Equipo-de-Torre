// Bumpear CACHE en CADA cambio del SW o del precache, si no los usuarios ven contenido viejo.
const CACHE = "tacker-eqtorre-v4";

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./tacker-logo.png",
  "./header-equipo-torre.jpg",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const request = e.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // La Cache API sólo acepta http(s): chrome-extension:, blob:, data: revientan con TypeError.
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.origin !== self.location.origin) return;

  // Network-first con fallback a caché; navegaciones caen a index.html (SPA).
  e.respondWith(
    fetch(request)
      .then((res) => {
        const copia = res.clone();
        caches
          .open(CACHE)
          .then((c) => c.put(request, copia))
          .catch(() => {});
        return res;
      })
      .catch(() =>
        caches
          .match(request)
          .then((hit) => hit ?? (request.mode === "navigate" ? caches.match("./index.html") : undefined))
          .then((r) => r ?? Response.error()),
      ),
  );
});
