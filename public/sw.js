// Cache public assets only; never cache queries, ticket pages, evidence, or accounts.
const CACHE = "curbside-public-v5";
const ASSETS = [
  "/offline.html",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/nyc-boroughs.json",
  "/nyc-backdrop.webp",
  "/nyc-backdrop-light.webp",
  "/fonts/manrope-latin-wght-normal.woff2",
  "/fonts/ibm-plex-mono-latin-400-normal.woff2",
  "/fonts/noto-sans-sc-ui.woff2",
];
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("curbside-public-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (
    e.request.method !== "GET" ||
    u.origin !== self.location.origin ||
    u.pathname.startsWith("/api/")
  )
    return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/offline.html")));
    return;
  }
  if (ASSETS.includes(u.pathname))
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
