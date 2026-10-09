import { json } from "../_lib/http.js";
export async function onRequestGet({ env }) {
  if (!env?.DB) return json({ error: "Database belum tersambung." }, 503);
  try {
    const { results = [] } = await env.DB.prepare(
      "SELECT id, name, slug, description, sort_order FROM categories WHERE lower(status)='active' ORDER BY sort_order, name"
    ).all();
    return json(results);
  } catch {
    return json({ error: "Gagal mengambil kategori. Pastikan migration D1 sudah dijalankan." }, 503);
  }
}
