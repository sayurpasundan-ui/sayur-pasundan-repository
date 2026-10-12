import { json, sameOrigin } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { validImageMagic } from "../../_lib/image-validation.js";
import { IMAGE_D1_MAX_BYTES, saveImageToD1 } from "../../_lib/image-storage.js";

const TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/avif", "avif"]]);
const MAX_BYTES = 6 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const useR2 = Boolean(env?.PRODUCT_IMAGES);
  if (!useR2 && !env?.DB) return json({ error: "Penyimpanan gambar belum tersedia: pasang binding D1 (DB) atau R2 (PRODUCT_IMAGES)." }, 503);
  const limit = useR2 ? MAX_BYTES : IMAGE_D1_MAX_BYTES, limitLabel = useR2 ? "6 MB" : "1,2 MB";
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > limit + 128 * 1024) return json({ error: `Ukuran unggahan melebihi batas ${limitLabel}.` }, 413);

  let form;
  try { form = await request.formData(); }
  catch { return json({ error: "Form upload tidak valid." }, 400); }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return json({ error: "File gambar wajib dipilih." }, 400);
  if (file.size > limit) return json({ error: `Ukuran foto maksimal ${limitLabel}. Kecilkan foto terlebih dahulu.` }, 413);
  if (!TYPES.has(file.type)) return json({ error: "Format gambar yang didukung: JPG, PNG, WebP, AVIF." }, 415);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validImageMagic(file.type, bytes)) return json({ error: "Isi file tidak cocok dengan format gambar yang dipilih." }, 415);
  const productId = String(form.get("product_id") || "general").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "general";
  const key = `product-${productId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${TYPES.get(file.type)}`;
  try {
    if (useR2) await env.PRODUCT_IMAGES.put(key, bytes, { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
    else await saveImageToD1(env.DB, key, file.type, bytes);
    return json({ ok: true, key, image_url: `/api/images/${key}` }, 201);
  } catch (error) {
    console.error("[admin/upload] Upload gambar gagal", error);
    return json({ error: useR2 ? "Upload ke R2 gagal." : "Gambar belum dapat disimpan ke database." }, 500);
  }
}
