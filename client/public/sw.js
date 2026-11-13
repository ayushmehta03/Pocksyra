/* Pocksyra service worker: app-shell caching and an offline fallback.
   Authenticated data (/auth, /api, /me) is never cached. */
const VERSION = "v1";
const SHELL = `pocksyra-shell-${VERSION}`;
const STATIC = `pocksyra-static-${VERSION}`;
const PAGES = `pocksyra-pages-${VERSION}`;
const KEEP = [SHELL, STATIC, PAGES];
const MAX_PAGES = 30;
const PRECACHE = ["/offline.html", "/pwa-icon/192", "/pwa-icon/512"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pocksyra-") && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok) {
      cache.put(request, res.clone());
      trim(PAGES, MAX_PAGES);
    }
    return res;
  } catch {
    return (await cache.match(request)) || (await caches.match("/offline.html"));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p.startsWith("/auth/") || p.startsWith("/api/") || p === "/me") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  } else if (p.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (p.startsWith("/pwa-icon/") || p === "/manifest.webmanifest" || p === "/offline.html") {
    event.respondWith(staleWhileRevalidate(request));
  }
});
