/*
 * Service worker: offline play, and the reason installing this on an iPad
 * matters.
 *
 * Beyond working on a plane, being installed to the Home Screen is what exempts
 * the site from Safari's 7-day cap on script-writable storage. Without it, a
 * child who doesn't play for a week can come back to an empty profile list.
 *
 * ── Caching strategy, and why it isn't uniform ──────────────────────────────
 * Two classes of request, two rules:
 *
 *   /_astro/*   Content-hashed by the build, so a given URL's bytes can never
 *               change. Cache-first, kept forever. A new build produces new
 *               filenames rather than new content at old ones.
 *
 *   Everything  Network-first, falling back to cache. HTML has no hash in its
 *   else        URL, so cache-first would pin a player to whatever version
 *               they first loaded — the classic "I deployed a fix and nobody
 *               sees it" service-worker trap. Network-first costs one round
 *               trip online and still works fully offline.
 *
 * Bump CACHE to evict everything; old caches are deleted on activate.
 */

const CACHE = "schoolskills-v2";

// The shell worth having before the first offline visit. Deliberately short —
// hashed assets arrive on their own as they're requested.
//
// The two fonts are here because they're the two the pages preload, and unlike
// everything else in this list their absence is visible rather than fatal: an
// offline first visit would render the whole site in Arial and look broken
// rather than look offline. They're unhashed and served from our own origin
// (see src/styles/fonts.css for why not a CDN), so the URLs are stable.
const PRECACHE = [
  "/",
  "/flash-cards",
  "/404.html",
  "/manifest.webmanifest",
  "/fonts/lilita-one-latin-400.woff2",
  "/fonts/nunito-latin-var.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Individually, and tolerating failures: one 404 in the list would
      // otherwise reject addAll and leave the worker never installed.
      .then((cache) =>
        Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {}))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GETs are cacheable, and cross-origin requests are none of our
  // business — the site makes none, but an extension's might pass through.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_astro/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache real successes. Caching an opaque or error response would
        // serve that error back offline as though it were the page.
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        // An uncached deep link while offline still deserves the app shell
        // rather than the browser's dinosaur.
        if (request.mode === "navigate") {
          return (
            (await caches.match("/flash-cards")) ??
            (await caches.match("/")) ??
            Response.error()
          );
        }
        return Response.error();
      }),
  );
});
