import { json } from "../_lib/http.js";
export async function onRequestGet({ env, request }) {
  if (!env?.DB) return json([]);
  const url = new URL(request.url), position = String(url.searchParams.get("position") || "hero");
  if (!new Set(["hero","promo","footer"]).has(position)) return json({ error: "Posisi banner tidak valid." }, 400);
  const now = new Date().toISOString();
  try {
    const { results = [] } = await env.DB.prepare(`SELECT id,title,alt_text,image_url,mobile_image_url,link_url,position,sort_order FROM banners WHERE is_active=1 AND position=? AND (starts_at IS NULL OR starts_at='' OR starts_at<=?) AND (ends_at IS NULL OR ends_at='' OR ends_at>=?) ORDER BY sort_order,id DESC LIMIT 20`).bind(position,now,now).all();
    return json(results);
  } catch { return json([]); }
}
