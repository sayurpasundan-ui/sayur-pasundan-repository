const CACHE = "sayur-pasundan-static-v6";
const STATIC = ["/", "/detail.html", "/tentang-kami.html", "/kebijakan-pengiriman.html", "/cara-belanja.html", "/lacak-pesanan.html", "/pesanan.html", "/assets/style.css", "/assets/app.js", "/assets/detail.js", "/assets/order.js", "/assets/favicon.svg", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && (url.pathname === "/" || url.pathname.endsWith(".html") || url.pathname.startsWith("/assets/") || url.pathname === "/manifest.webmanifest")) {
      const clone = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, clone));
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match("/"))));
});
