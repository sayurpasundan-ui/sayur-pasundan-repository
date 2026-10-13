const CACHE = "sayur-pasundan-static-v8";
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

// ---- Notifikasi (Web Push). Push tiba tanpa isi; pesan diambil dari server berdasarkan hash langganan perangkat.
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
self.addEventListener("push", event => event.waitUntil((async () => {
  let message = { title: "Sayur Pasundan", body: "Ada pembaruan untuk Anda. Ketuk untuk melihat.", url: "/" };
  try {
    const sub = await self.registration.pushManager.getSubscription();
    if (sub) {
      const response = await fetch("/api/push/latest?h=" + await sha256Hex(sub.endpoint), { cache: "no-store" });
      if (response.ok) { const data = await response.json(); if (data && data.title) message = { ...message, ...data }; }
    }
  } catch { /* tampilkan pesan umum */ }
  await self.registration.showNotification(message.title, {
    body: message.body, icon: "/icon-192.png", badge: "/icon-192.png", tag: message.tag || "sayur-pasundan", renotify: true, data: { url: message.url || "/" }
  });
})()));
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const client of list) { if (client.url === target && "focus" in client) return client.focus(); }
    return self.clients.openWindow(target);
  }));
});
