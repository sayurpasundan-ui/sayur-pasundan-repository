import { json, readJson, requireDb } from "../../_lib/http.js";
import { cartItemFromLine, computeNeeds } from "../../_lib/kitchen.js";

// POST /api/kitchen/needs  { items:[{recipe_id,servings}], choices:{ "<lineId>": {id_satuan, quantity?} } }
// Menghitung kebutuhan bahan untuk rencana menu dan mencocokkannya dengan katalog (harga/stok dari D1).
export async function onRequestPost({ request, env }) {
  let db;
  try { db = requireDb(env); } catch { return json({ error: "Database belum tersambung." }, 503); }
  try {
    const body = await readJson(request);
    const result = await computeNeeds(db, body);
    const lines = result.lines.map(line => ({ ...line, cart_item: cartItemFromLine(line) }));
    const ready = lines.filter(l => l.cart_item && (l.status === "siap" || l.status === "manual"));
    return json({
      lines, problems: result.problems, entries: result.entries,
      summary: { total_lines: lines.length, ready_lines: ready.length, needs_choice: lines.filter(l => l.status === "perlu_dipilih").length,
        estimated_total: ready.filter(l => !l.optional).reduce((s, l) => s + l.subtotal, 0) }
    });
  } catch (error) {
    console.error("[kitchen/needs]", error?.message || error);
    return json({ error: "Kebutuhan dapur belum dapat dihitung. Coba lagi." }, 500);
  }
}
