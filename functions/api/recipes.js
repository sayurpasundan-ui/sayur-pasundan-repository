import { json } from "../_lib/http.js";
import { allBaseRecipes, cardOf, filterRecipes, isVisible, loadOverrides, tagFacets } from "../_lib/recipes.js";

// GET /api/recipes?q=&tag=Ayam,Praktis&rotation=Minggu 1&difficulty=Mudah&max_minutes=30&limit=24&offset=0&ids=RCP-001,RCP-002
// Hanya resep berstatus tampil. Tag hanya untuk pencarian/filter, bukan untuk membatasi waktu makan.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url), p = url.searchParams;
  try {
    const overrides = await loadOverrides(env?.DB).catch(() => new Map());
    let items = allBaseRecipes().filter(r => isVisible(r, overrides.get(r.id))).map(r => cardOf(r, overrides.get(r.id)));
    const facets = tagFacets(items);
    const ids = (p.get("ids") || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 40);
    if (ids.length) items = items.filter(r => ids.includes(r.id));
    items = filterRecipes(items, {
      q: String(p.get("q") || "").slice(0, 80), tags: (p.get("tag") || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 6),
      rotation: String(p.get("rotation") || ""), difficulty: String(p.get("difficulty") || ""), maxMinutes: Math.max(0, Number(p.get("max_minutes")) || 0)
    });
    const total = items.length, limit = Math.min(60, Math.max(1, Number(p.get("limit")) || 24)), offset = Math.max(0, Number(p.get("offset")) || 0);
    return json({ total, limit, offset, items: items.slice(offset, offset + limit), tags: facets });
  } catch (error) {
    console.error("[recipes]", error?.message || error);
    return json({ error: "Resep belum dapat dimuat." }, 503);
  }
}
