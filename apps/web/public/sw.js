/*
 * DevOps Easy Learning service worker. It does one thing: when a page can't load because the device is offline, it shows
 * /offline.html. It never caches the application's pages, scripts, API responses or videos, so the installed app always
 * runs the live version (no "update available" step, no stale or private pages on the device).
 * Bump VERSION when this file changes. To remove it, deploy a worker that calls self.registration.unregister().
 */
const VERSION = "del-sw-v2";
const OFFLINE = "/offline.html";
// The offline page is self-contained (inline styles and logo), so it is the only file kept.
const PRECACHE = [OFFLINE];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only page navigations get the offline fallback; everything else goes straight to the network.
  if (req.mode !== "navigate") return;
  event.respondWith(
    fetch(req).catch(async () => (await caches.match(OFFLINE)) || new Response("You are offline.", { headers: { "Content-Type": "text/plain" } })),
  );
});
