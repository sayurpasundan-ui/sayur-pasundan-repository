import { json, requireDb } from "../_lib/http.js";
import { readStoreSettings } from "../_lib/store-config.js";

export async function onRequestGet({ env }) {
  if (!env?.DB) return json({ error: "Database belum tersambung." }, 503);
  try {
    const db = requireDb(env);
    const [rows, settings] = await Promise.all([
      db.prepare(`SELECT code,name,kind,account_number,account_name,logo_url,instructions,is_active,sort_order FROM payment_methods WHERE is_active=1 ORDER BY sort_order,name`).all(),
      readStoreSettings(db, env)
    ]);
    return json((rows.results || []).map(item => ({ ...item,
      allowed_cod_districts: item.kind === "cod" ? settings.codAllowedDistricts : [],
      available: item.kind !== "cod" || settings.codEnabled,
      unavailable_reason: item.kind === "cod" && !settings.codEnabled ? "COD dinonaktifkan oleh toko." : null
    })));
  } catch (error) {
    console.error("[payment-methods] Gagal memuat metode pembayaran", error);
    return json({ error: "Metode pembayaran belum siap. Jalankan migrasi Tahap 2 dan 3." }, 503);
  }
}
