import { json, requireDb } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return auth.response;
  const readiness = {
    database: Boolean(env?.DB),
    productImages: Boolean(env?.PRODUCT_IMAGES || env?.DB),
    paymentProofs: Boolean(env?.PAYMENT_PROOFS || env?.DB),
    migrations: false,
    storeSettings: false,
    banners: false,
    promotions: false
  };
  if (env?.DB) {
    try {
      const db = requireDb(env);
      const { results = [] } = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const names = new Set(results.map(row => row.name));
      readiness.storeSettings = names.has("store_settings");
      readiness.banners = names.has("banners");
      readiness.promotions = names.has("promotions");
      let orderColumns = new Set();
      if (names.has("orders")) {
        const { results: columns = [] } = await db.prepare("PRAGMA table_info(orders)").all();
        orderColumns = new Set(columns.map(column => column.name));
      }
      readiness.migrations = ["orders", "payment_methods", "payment_proofs", "payment_refs", "order_status_history", "store_settings", "banners", "promotions"].every(name => names.has(name)) && ["customer_province", "customer_map_url"].every(name => orderColumns.has(name));
    } catch {
      readiness.database = false;
    }
  }
  return json({ ok: true, readiness });
}
