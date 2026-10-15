// Data resep: bank 100 resep dari Excel (functions/_data/recipes-data.js, hanya-baca) + penyesuaian admin di D1.
//  - recipe_overrides        : visibilitas, foto, alt foto, alat, tanda matang, tips penyajian (per resep)
//  - recipe_ingredient_map   : pemetaan nama bahan -> produk/varian/satuan katalog (diverifikasi admin)
// Tabel dibuat otomatis (CREATE TABLE IF NOT EXISTS); data resep asli tidak pernah ditimpa.
import { RECIPES } from "../_data/recipes-data.js";

let tablesReady = false;
const BY_ID = new Map(RECIPES.map(r => [r.id, r]));
export const RECIPE_COUNT = RECIPES.length;

export async function ensureRecipeTables(db) {
  if (tablesReady) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS recipe_overrides (
    recipe_id TEXT PRIMARY KEY, visible INTEGER, photo_url TEXT, photo_alt TEXT, photo_status TEXT,
    tools TEXT, doneness TEXT, serving_tips TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS recipe_ingredient_map (
    ingredient_key TEXT PRIMARY KEY, ingredient_name TEXT NOT NULL, status TEXT NOT NULL,
    product_id INTEGER, id_varian INTEGER, id_satuan INTEGER, factors TEXT, note TEXT,
    verified_at TEXT, updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`).run();
  tablesReady = true;
}

export const getBaseRecipe = id => BY_ID.get(String(id)) || null;
export const allBaseRecipes = () => RECIPES;

export async function loadOverrides(db) {
  if (!db) return new Map();
  await ensureRecipeTables(db);
  const { results = [] } = await db.prepare(`SELECT * FROM recipe_overrides`).all();
  return new Map(results.map(r => [r.recipe_id, r]));
}

const lines = text => String(text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);

export function photoOf(base, override) {
  const url = (override && override.photo_url) || base.photo_url || null;
  return {
    url, status: url ? "tersedia" : "belum",
    alt: url ? ((override && override.photo_alt) || `Foto masakan ${base.name}`) : null
  };
}
export const isVisible = (base, override) => (override && override.visible != null ? Number(override.visible) === 1 : base.visible);

// Bentuk ringkas untuk kartu / daftar
export function cardOf(base, override) {
  return {
    id: base.id, name: base.name, description: base.description, tags: base.tags, servings: base.servings,
    prep_minutes: base.prep_minutes, cook_minutes: base.cook_minutes, total_minutes: base.total_minutes,
    difficulty: base.difficulty, rotation: base.rotation, photo: photoOf(base, override)
  };
}

// Bentuk lengkap untuk halaman detail
export function detailOf(base, override) {
  return {
    ...cardOf(base, override),
    ingredients: base.ingredients.map(i => ({ order: i.order, key: i.key, name: i.name, amount: i.amount, unit: i.unit, kind: i.kind, optional: i.optional, note: i.note })),
    steps: base.steps,
    cooking_note: base.cooking_note || null,
    tools: lines(override && override.tools),
    doneness: lines(override && override.doneness),
    serving_tips: lines(override && override.serving_tips),
    review_status: base.review_status
  };
}

export function tagFacets(items) {
  const counts = new Map();
  for (const item of items) for (const t of item.tags) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "id"));
}

export function filterRecipes(items, { q = "", tags = [], rotation = "", difficulty = "", maxMinutes = 0 } = {}) {
  const needle = q.trim().toLowerCase();
  return items.filter(r => {
    if (needle && !(r.name.toLowerCase().includes(needle) || r.tags.some(t => t.toLowerCase().includes(needle)))) return false;
    if (tags.length && !tags.every(t => r.tags.includes(t))) return false;
    if (rotation && r.rotation !== rotation) return false;
    if (difficulty && r.difficulty !== difficulty) return false;
    if (maxMinutes && r.total_minutes > maxMinutes) return false;
    return true;
  });
}

export function normalizeFactors(input) {
  const out = {};
  if (input && typeof input === "object") for (const [unit, value] of Object.entries(input)) {
    const n = Number(value), u = String(unit).trim().toLowerCase().slice(0, 20);
    if (u && Number.isFinite(n) && n > 0 && n < 1e7) out[u] = n;
  }
  return out;
}

export async function loadMappings(db) {
  if (!db) return new Map();
  await ensureRecipeTables(db);
  const { results = [] } = await db.prepare(`SELECT * FROM recipe_ingredient_map`).all();
  return new Map(results.map(r => { let factors = {}; try { factors = normalizeFactors(JSON.parse(r.factors || "{}")); } catch {} return [r.ingredient_key, { ...r, factors }]; }));
}

// Semua nama bahan unik beserta pemakaiannya (untuk panel pemetaan)
export function ingredientIndex() {
  const index = new Map();
  for (const recipe of RECIPES) for (const ing of recipe.ingredients) {
    if (!index.has(ing.key)) index.set(ing.key, { key: ing.key, name: ing.name, recipes: new Set(), units: new Map(), kinds: new Set() });
    const entry = index.get(ing.key);
    entry.recipes.add(recipe.id); entry.kinds.add(ing.kind);
    entry.units.set(ing.unit, (entry.units.get(ing.unit) || 0) + 1);
  }
  return [...index.values()].map(e => ({ key: e.key, name: e.name, recipe_count: e.recipes.size, units: [...e.units.entries()].map(([unit, uses]) => ({ unit, uses })), kinds: [...e.kinds] }))
    .sort((a, b) => b.recipe_count - a.recipe_count || a.name.localeCompare(b.name, "id"));
}
