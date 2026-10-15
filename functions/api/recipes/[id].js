import { json } from "../../_lib/http.js";
import { detailOf, getBaseRecipe, isVisible, loadOverrides } from "../../_lib/recipes.js";

export async function onRequestGet({ env, params }) {
  const base = getBaseRecipe(String(params.id || "").toUpperCase());
  if (!base) return json({ error: "Resep tidak ditemukan." }, 404);
  try {
    const overrides = await loadOverrides(env?.DB).catch(() => new Map()), override = overrides.get(base.id);
    if (!isVisible(base, override)) return json({ error: "Resep tidak ditemukan." }, 404);
    return json(detailOf(base, override));
  } catch (error) { console.error("[recipes/id]", error?.message || error); return json({ error: "Resep belum dapat dimuat." }, 503); }
}
