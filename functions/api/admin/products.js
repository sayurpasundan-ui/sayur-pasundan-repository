import { json, readJson, requireDb, normalizeStatus, numberOr, safeText, toIntBool, sameOrigin } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

function validProduct(body) {
  return body && safeText(body.sku, 100) && safeText(body.name, 200) && safeText(body.slug, 220);
}
export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  try {
    const db = requireDb(env);
    const { results = [] } = await db.prepare(`SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.sort_order, p.name LIMIT 1500`).all();
    return json(results);
  } catch (e) { return json({ error: String(e?.message || "Gagal mengambil produk") }, 503); }
}
export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const b = await readJson(request); if (!validProduct(b)) return json({ error: "SKU, nama produk, dan slug wajib diisi." }, 400);
  if (String(b.stock_mode || "unlimited").toLowerCase() !== "unlimited") return json({ error: "Mode stok fisik belum didukung. Gunakan mode unlimited sampai modul stok per satuan dibuat." }, 400);
  try {
    const db = requireDb(env);
    const result = await db.prepare(`INSERT INTO products (sku,name,slug,category_id,short_description,description,tips_storage,cooking_ideas,stock,stock_mode,stock_status,status,is_featured,sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      safeText(b.sku,100), safeText(b.name,200), safeText(b.slug,220), b.category_id === "" || b.category_id == null ? null : numberOr(b.category_id),
      safeText(b.short_description), safeText(b.description), safeText(b.tips_storage), safeText(b.cooking_ideas), numberOr(b.stock), String(b.stock_mode || "unlimited").toLowerCase()==="tracked"?"tracked":"unlimited", normalizeStatus(b.stock_status,"in_stock"),
      normalizeStatus(b.status,"draft"), toIntBool(b.is_featured), numberOr(b.sort_order)
    ).run();
    return json({ ok: true, id: result.meta?.last_row_id }, 201);
  } catch (e) { return json({ error: String(e?.message || "Gagal membuat produk") }, 400); }
}
