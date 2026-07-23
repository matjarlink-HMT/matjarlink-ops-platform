// Network-first service worker: always serve fresh content when online (so
// deploys/updates show immediately), fall back to cache when offline.
const CACHE = "mlops-v3";
// Don't pre-cache the versioned bundles (app.js/i18n.js now carry a ?v= stamp and
// are fetched fresh network-first); only the shell entry so offline still loads.
const SHELL = ["/", "/manifest.json", "/logo.svg", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok && !e.request.url.includes("/api/")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/")))
  );
});
