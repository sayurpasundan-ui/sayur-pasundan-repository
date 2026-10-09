import { json, readJson, requireDb, safeText, numberOr, normalizeStatus, sameOrigin } from "../../../_lib/http.js";
import { requireAdmin } from "../../../_lib/auth.js";
function slugify(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180); }
export async function onRequestPut({ request, env, params }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const id = Number(params.id), body = await readJson(request), name = safeText(body?.name, 160), slug = slugify(body?.slug || name);
  if (!Number.isInteger(id) || id <= 0 || !name || !slug) return json({ error: "ID dan nama kategori wajib valid." }, 400);
  try { await requireDb(env).prepare("UPDATE categories SET name=?,slug=?,description=?,status=?,sort_order=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
    .bind(name, slug, safeText(body.description, 600), normalizeStatus(body.status, "active"), numberOr(body.sort_order), id).run(); return json({ ok: true }); }
  catch (error) { return json({ error: /unique/i.test(String(error?.message)) ? "Slug kategori sudah digunakan." : "Kategori gagal diperbarui." }, 400); }
}
export async function onRequestDelete({ request, env, params }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const id = Number(params.id); if (!Number.isInteger(id) || id <= 0) return json({ error: "ID kategori tidak valid." }, 400);
  try { await requireDb(env).prepare("UPDATE categories SET status='archived',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(id).run(); return json({ ok: true, message: "Kategori diarsipkan; data lama tetap aman." }); }
  catch { return json({ error: "Kategori tidak dapat diarsipkan." }, 400); }
}
