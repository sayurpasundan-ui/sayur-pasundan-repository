import { json, requireDb } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { allBaseRecipes, isVisible, loadOverrides, photoOf } from "../../_lib/recipes.js";

// Daftar seluruh resep (termasuk yang disembunyikan) untuk pengelolaan admin.
export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  try {
    const overrides = await loadOverrides(requireDb(env));
    return json(allBaseRecipes().map(r => {
      const o = overrides.get(r.id);
      return { id: r.id, name: r.name, tags: r.tags, rotation: r.rotation, servings: r.servings, difficulty: r.difficulty, review_status: r.review_status,
        visible_default: r.visible, visible: isVisible(r, o), photo: photoOf(r, o), has_override: Boolean(o),
        tools: o?.tools || "", doneness: o?.doneness || "", serving_tips: o?.serving_tips || "" };
    }));
  } catch (error) { console.error("[admin/recipes]", error?.message || error); return json({ error: "Daftar resep belum dapat dimuat." }, 503); }
}
