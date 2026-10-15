import { json, readJson, requireDb, safeText, sameOrigin } from "../../../_lib/http.js";
import { requireAdmin } from "../../../_lib/auth.js";
import { ensureRecipeTables, getBaseRecipe } from "../../../_lib/recipes.js";

// Foto hanya boleh dari: unggahan aplikasi (/api/images/...), aset situs (/assets/...), atau alamat https yang Anda punya izin pakainya.
function validPhotoUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^\/(api\/images|assets)\/[A-Za-z0-9._\/-]+$/.test(url)) return url;
  try { const u = new URL(url); if (u.protocol === "https:" && url.length <= 600) return u.href; } catch {}
  return null;
}

// PUT: simpan penyesuaian per resep. Data resep asli (bahan, langkah) tidak diubah.
// DELETE: kembalikan ke data asli Excel.
export async function onRequestPut({ request, env, params }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const base = getBaseRecipe(String(params.id || "").toUpperCase());
  if (!base) return json({ error: "Resep tidak ditemukan." }, 404);
  const b = await readJson(request) || {};
  const photo = validPhotoUrl(b.photo_url);
  if (photo === null) return json({ error: "Alamat foto tidak valid. Gunakan unggahan, /assets/..., atau alamat https." }, 400);
  const visible = b.visible === null || b.visible === undefined ? null : (b.visible ? 1 : 0);
  try {
    const db = requireDb(env); await ensureRecipeTables(db);
    await db.prepare(`INSERT INTO recipe_overrides(recipe_id,visible,photo_url,photo_alt,photo_status,tools,doneness,serving_tips,updated_at) VALUES(?,?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(recipe_id) DO UPDATE SET visible=excluded.visible,photo_url=excluded.photo_url,photo_alt=excluded.photo_alt,photo_status=excluded.photo_status,
        tools=excluded.tools,doneness=excluded.doneness,serving_tips=excluded.serving_tips,updated_at=excluded.updated_at`)
      .bind(base.id, visible, photo || null, safeText(b.photo_alt, 240) || null, photo ? "tersedia" : "belum",
        safeText(b.tools, 1500) || null, safeText(b.doneness, 1500) || null, safeText(b.serving_tips, 1500) || null).run();
    return json({ ok: true });
  } catch (error) { console.error("[admin/recipes PUT]", error?.message || error); return json({ error: "Gagal menyimpan resep." }, 500); }
}

export async function onRequestDelete({ request, env, params }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const base = getBaseRecipe(String(params.id || "").toUpperCase());
  if (!base) return json({ error: "Resep tidak ditemukan." }, 404);
  try { const db = requireDb(env); await ensureRecipeTables(db); await db.prepare(`DELETE FROM recipe_overrides WHERE recipe_id=?`).bind(base.id).run(); return json({ ok: true }); }
  catch (error) { return json({ error: "Gagal mengembalikan resep ke data asli." }, 500); }
}
