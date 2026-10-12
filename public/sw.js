const CACHE = "sayur-pasundan-static-v7";
const STATIC = ["/", "/assets/style.css", "/assets/app.js", "/assets/detail.js", "/assets/order.js", "/assets/favicon.svg", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(STATIC.map(url => cache.add(url)))).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")) return;
  event.respondWith(fetch(event.request).then(response => {
    // Jangan menyimpan respons hasil pengalihan; respons semacam itu tidak boleh dipakai untuk navigasi.
    if (response.ok && !response.redirected && response.type === "basic" && (url.pathname === "/" || url.pathname.startsWith("/assets/") || url.pathname === "/manifest.webmanifest")) {
      const clone = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, clone));
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === "navigate" ? caches.match("/") : Response.error()))));
});
