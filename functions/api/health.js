import { json } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  if (!env?.DB) return json({ ok: false, database: "unbound", message: "Binding D1 bernama DB belum dipasang." }, 503);
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return json({ ok: true, database: "connected", store: env.STORE_NAME || "SAYUR PASUNDAN" });
  } catch (error) {
    console.error("[health] Pemeriksaan koneksi D1 gagal", error);
    return json({ ok: false, database: "error", message: "Koneksi D1 gagal." }, 503);
  }
}
