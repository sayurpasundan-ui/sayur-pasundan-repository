import { json, readJson, requireDb, normalizeStatus, numberOr, safeText, toIntBool, sameOrigin } from "../../../_lib/http.js";
import { requireAdmin } from "../../../_lib/auth.js";
export async function onRequestPut({ request, env, params }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const id = Number(params.id); if (!Number.isInteger(id) || id <= 0) return json({ error: "ID produk tidak valid." }, 400);
  const b = await readJson(request); if (!b || !safeText(b.name,200) || !safeText(b.sku,100) || !safeText(b.slug,220)) return json({ error: "SKU, nama, dan slug wajib diisi." }, 400);
  if (String(b.stock_mode || "unlimited").toLowerCase() !== "unlimited") return json({ error: "Mode stok fisik belum didukung. Gunakan mode unlimited sampai modul stok per satuan dibuat." }, 400);
  try {
    const db = requireDb(env);
    await db.prepare(`UPDATE products SET sku=?,name=?,slug=?,category_id=?,short_description=?,description=?,tips_storage=?,cooking_ideas=?,stock=?,stock_mode=?,stock_status=?,status=?,is_featured=?,sort_order=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).bind(
      safeText(b.sku,100), safeText(b.name,200), safeText(b.slug,220), b.category_id === "" || b.category_id == null ? null : numberOr(b.category_id),
      safeText(b.short_description), safeText(b.description), safeText(b.tips_storage), safeText(b.cooking_ideas), numberOr(b.stock), String(b.stock_mode || "unlimited").toLowerCase()==="tracked"?"tracked":"unlimited", normalizeStatus(b.stock_status,"in_stock"),
      normalizeStatus(b.status,"draft"), toIntBool(b.is_featured), numberOr(b.sort_order), id
    ).run();
    return json({ ok: true });
  } catch (e) { return json({ error: String(e?.message || "Gagal memperbarui produk") }, 400); }
}
export async function onRequestDelete({ request, env, params }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const id = Number(params.id); if (!Number.isInteger(id) || id <= 0) return json({ error: "ID produk tidak valid." }, 400);
  try { await requireDb(env).prepare("UPDATE products SET status='archived',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(id).run(); return json({ ok: true, message: "Produk diarsipkan; catatan transaksi lama tetap aman." }); }
  catch { return json({ error: "Produk gagal diarsipkan." }, 400); }
}
