import "../../../public/assets/units.js";
import "../../../public/assets/recipe-core.js";
import { json, readJson, requireDb, safeText, sameOrigin } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { ensureRecipeTables, ingredientIndex, loadMappings, normalizeFactors } from "../../_lib/recipes.js";
import { loadAllUnits, loadUnitsByIds } from "../../_lib/kitchen.js";

const RC = globalThis.RecipeCore;
const STATUSES = ["verified", "pantry", "unavailable"];

// Setiap satuan takaran resep: bisa dihitung otomatis / lewat faktor admin / harus ditentukan pelanggan
function convertibility(units, unitLabel, factors) {
  return units.map(({ unit }) => {
    const per = unitLabel ? RC.unitsPerSaleUnit(unit, unitLabel, factors) : null;
    return { unit, mode: !per ? "manual" : per.basis === "admin" ? "faktor" : "otomatis", per_unit: per ? per.value : null };
  });
}

// Saran pemetaan: HANYA saran untuk ditinjau admin. Tidak pernah diterapkan otomatis.
function suggest(ingredientName, units) {
  const needle = RC.normalizeKey(ingredientName), byProduct = new Map();
  for (const u of units) {
    const hay = RC.normalizeKey(u.product_name);
    let kind = null;
    if (hay === needle) kind = "tepat";
    else if (needle.length >= 4 && (hay.includes(needle) || (hay.length >= 4 && needle.includes(hay)))) kind = "mirip";
    if (!kind) continue;
    if (!byProduct.has(u.product_id)) byProduct.set(u.product_id, { product_id: u.product_id, name: u.product_name, kind, units: [] });
    byProduct.get(u.product_id).units.push({ id_satuan: u.id_satuan, label: `${u.variant_label ? u.variant_label + " · " : ""}${u.nama_satuan}`, sale_type: u.sale_type, harga: u.harga, available: u.available, nama_satuan: u.nama_satuan });
  }
  return [...byProduct.values()].sort((a, b) => (a.kind === "tepat" ? 0 : 1) - (b.kind === "tepat" ? 0 : 1) || a.name.localeCompare(b.name, "id")).slice(0, 5);
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  try {
    const db = requireDb(env); await ensureRecipeTables(db);
    const [mappings, units] = await Promise.all([loadMappings(db), loadAllUnits(db)]);
    const mappedUnits = await loadUnitsByIds(db, [...mappings.values()].map(m => Number(m.id_satuan)));
    const items = ingredientIndex().map(ing => {
      const m = mappings.get(ing.key) || null, unit = m && m.id_satuan ? mappedUnits.get(Number(m.id_satuan)) : null;
      return { ...ing,
        mapping: m ? { status: m.status, id_satuan: m.id_satuan, product_id: m.product_id, factors: m.factors, note: m.note, verified_at: m.verified_at,
          target: unit ? { product_name: unit.product_name, label: `${unit.variant_label ? unit.variant_label + " · " : ""}${unit.nama_satuan}`, harga: unit.harga, available: unit.available, nama_satuan: unit.nama_satuan, sale_type: unit.sale_type } : null,
          inactive: m.status === "verified" && !unit } : null,
        convertibility: unit ? convertibility(ing.units, unit.nama_satuan, m.factors) : [],
        suggestions: m && (m.status !== "verified" || unit) ? [] : suggest(ing.name, units) };
    });
    return json({ items, summary: { total: items.length, verified: items.filter(i => i.mapping?.status === "verified" && !i.mapping.inactive).length,
      pantry: items.filter(i => i.mapping?.status === "pantry").length, unavailable: items.filter(i => i.mapping?.status === "unavailable").length } });
  } catch (error) { console.error("[admin/recipe-mapping GET]", error?.message || error); return json({ error: "Pemetaan bahan belum dapat dimuat." }, 503); }
}

export async function onRequestPut({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const b = await readJson(request) || {};
  const ing = ingredientIndex().find(i => i.key === String(b.ingredient_key || ""));
  if (!ing) return json({ error: "Bahan resep tidak ditemukan." }, 404);
  const status = String(b.status || "");
  if (!STATUSES.includes(status)) return json({ error: "Status pemetaan tidak valid." }, 400);
  try {
    const db = requireDb(env); await ensureRecipeTables(db);
    let unit = null;
    if (status === "verified") {
      unit = (await loadUnitsByIds(db, [Number(b.id_satuan)])).get(Number(b.id_satuan));
      if (!unit) return json({ error: "Satuan produk tidak ditemukan atau tidak aktif di katalog." }, 400);
    }
    const factors = normalizeFactors(b.factors);
    await db.prepare(`INSERT INTO recipe_ingredient_map(ingredient_key,ingredient_name,status,product_id,id_varian,id_satuan,factors,note,verified_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(ingredient_key) DO UPDATE SET status=excluded.status,product_id=excluded.product_id,id_varian=excluded.id_varian,id_satuan=excluded.id_satuan,
        factors=excluded.factors,note=excluded.note,verified_at=excluded.verified_at,updated_at=excluded.updated_at`)
      .bind(ing.key, ing.name, status, unit?.product_id ?? null, unit?.id_varian ?? null, unit?.id_satuan ?? null, JSON.stringify(factors), safeText(b.note, 300) || null,
        status === "verified" ? new Date().toISOString() : null).run();
    return json({ ok: true, convertibility: unit ? convertibility(ing.units, unit.nama_satuan, factors) : [] });
  } catch (error) { console.error("[admin/recipe-mapping PUT]", error?.message || error); return json({ error: "Gagal menyimpan pemetaan." }, 500); }
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const b = await readJson(request) || {};
  try { const db = requireDb(env); await ensureRecipeTables(db); await db.prepare(`DELETE FROM recipe_ingredient_map WHERE ingredient_key=?`).bind(String(b.ingredient_key || "")).run(); return json({ ok: true }); }
  catch (error) { return json({ error: "Gagal menghapus pemetaan." }, 500); }
}
