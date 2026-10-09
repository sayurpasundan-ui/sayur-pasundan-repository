import { json, readJson, requireDb, safeText, numberOr, normalizeStatus, sameOrigin } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

function slugify(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180); }
export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  try { const { results = [] } = await requireDb(env).prepare("SELECT * FROM categories ORDER BY sort_order,name LIMIT 500").all(); return json(results); }
  catch { return json({ error: "Gagal memuat kategori." }, 503); }
}
export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const body = await readJson(request); const name = safeText(body?.name, 160); const slug = slugify(body?.slug || name);
  if (!name || !slug) return json({ error: "Nama kategori wajib diisi." }, 400);
  try {
    const result = await requireDb(env).prepare("INSERT INTO categories(name,slug,description,status,sort_order) VALUES(?,?,?,?,?)")
      .bind(name, slug, safeText(body.description, 600), normalizeStatus(body.status, "active"), numberOr(body.sort_order)).run();
    return json({ ok: true, id: result.meta?.last_row_id }, 201);
  } catch (error) { return json({ error: /unique/i.test(String(error?.message)) ? "Slug kategori sudah digunakan." : "Kategori gagal disimpan." }, 400); }
}
