import { readImageFromD1 } from "../../_lib/image-storage.js";

export async function onRequestGet({ request, env, params, waitUntil }) {
  const key = String(params.key || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!key) return new Response("Not found", { status: 404 });
  const cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache) { const hit = await cache.match(request).catch(() => null); if (hit) return hit; }
  const headers = new Headers({ "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "etag": `"${key}"` });
  let response = null;
  if (env?.PRODUCT_IMAGES) {
    const object = await env.PRODUCT_IMAGES.get(key);
    if (object) { object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag); response = new Response(object.body, { headers }); }
  }
  if (!response && env?.DB) {
    try {
      const image = await readImageFromD1(env.DB, key);
      if (image) { headers.set("content-type", image.mimeType); response = new Response(image.bytes, { headers }); }
    } catch (error) { console.error("[images] Gagal membaca gambar dari D1", error); }
  }
  if (!response) return new Response(env?.PRODUCT_IMAGES || env?.DB ? "Not found" : "Image storage is not configured", { status: env?.PRODUCT_IMAGES || env?.DB ? 404 : 503 });
  if (cache) { const copy = response.clone(); if (typeof waitUntil === "function") waitUntil(cache.put(request, copy).catch(() => {})); }
  return response;
}
