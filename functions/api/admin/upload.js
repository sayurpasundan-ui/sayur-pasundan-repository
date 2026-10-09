import { json, sameOrigin } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { validImageMagic } from "../../_lib/image-validation.js";

const TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/avif", "avif"]]);
const MAX_BYTES = 6 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_BYTES + 128 * 1024;

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  if (!env?.PRODUCT_IMAGES) return json({ error: "Binding R2 bernama PRODUCT_IMAGES belum dipasang." }, 503);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) return json({ error: "Ukuran unggahan melebihi batas 6 MB." }, 413);

  let form;
  try { form = await request.formData(); }
  catch { return json({ error: "Form upload tidak valid." }, 400); }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return json({ error: "File gambar wajib dipilih." }, 400);
  if (file.size > MAX_BYTES) return json({ error: "Ukuran foto maksimal 6 MB." }, 413);
  if (!TYPES.has(file.type)) return json({ error: "Format gambar yang didukung: JPG, PNG, WebP, AVIF." }, 415);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validImageMagic(file.type, bytes)) return json({ error: "Isi file tidak cocok dengan format gambar yang dipilih." }, 415);
  const productId = String(form.get("product_id") || "general").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "general";
  const key = `product-${productId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${TYPES.get(file.type)}`;
  try {
    await env.PRODUCT_IMAGES.put(key, bytes, { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
    return json({ ok: true, key, image_url: `/api/images/${key}` }, 201);
  } catch (error) {
    console.error("[admin/upload] Upload gambar gagal", error);
    return json({ error: "Upload ke R2 gagal." }, 500);
  }
}
