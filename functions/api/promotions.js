import { json } from "../_lib/http.js";
export async function onRequestGet({ env }) {
  if (!env?.DB) return json([]);
  const now = new Date().toISOString();
  try {
    const { results = [] } = await env.DB.prepare(`SELECT id,title,description,promo_type,promo_value,promo_code,starts_at,ends_at,sort_order FROM promotions WHERE is_active=1 AND (starts_at IS NULL OR starts_at='' OR starts_at<=?) AND (ends_at IS NULL OR ends_at='' OR ends_at>=?) ORDER BY sort_order,id DESC LIMIT 30`).bind(now,now).all();
    return json(results);
  } catch { return json([]); }
}
