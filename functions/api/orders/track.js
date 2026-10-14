import { json, readJson, requireDb, sameOrigin } from "../../_lib/http.js";
import { displayOrderStatus, expireOverdueOrders, normalizePhone } from "../../_lib/order-utils.js";
import { readStoreSettings } from "../../_lib/store-config.js";

export async function onRequestPost({ request, env , waitUntil }) {
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  if (!env?.DB) return json({ error: "Database belum tersambung." }, 503);
  const body = await readJson(request);
  const code = String(body?.order_code || "").trim().toUpperCase();
  const phone = normalizePhone(body?.customer_phone);
  if (!/^SP-[A-Z0-9]+-[A-Z0-9]{6,12}$/.test(code) || phone.length < 9) return json({ error: "Masukkan kode pesanan dan nomor WhatsApp dengan benar." }, 400);
  const db = requireDb(env);
  try {
    await expireOverdueOrders(db, { env, waitUntil });
    const order = await db.prepare(`SELECT id,order_code,customer_name,customer_phone,customer_address,customer_city,customer_district,customer_province,customer_lat,customer_lng,customer_map_url,notes,subtotal,shipping_fee,distance_km,total,status,payment_method,payment_status,payment_unique_code,payment_amount,payment_due_at,paid_at,cod_paid_at,cancelled_at,cancellation_reason,created_at,updated_at FROM orders WHERE order_code=?`).bind(code).first();
    if (!order || normalizePhone(order.customer_phone) !== phone) return json({ error: "Pesanan tidak ditemukan. Periksa kode pesanan dan nomor WhatsApp." }, 404);
    const { results: items = [] } = await db.prepare(`SELECT product_name,variant_label,unit_label,quantity,unit_price,line_total FROM order_items WHERE order_id=? ORDER BY id`).bind(order.id).all();
    const method = await db.prepare(`SELECT code,name,kind,account_number,account_name,logo_url,instructions FROM payment_methods WHERE code=?`).bind(order.payment_method).first();
    const proof = await db.prepare(`SELECT id,status,review_note,uploaded_at,reviewed_at FROM payment_proofs WHERE order_id=? ORDER BY uploaded_at DESC LIMIT 1`).bind(order.id).first();
    const { results: historyRows = [] } = await db.prepare(`SELECT status,payment_status,note,created_at FROM order_status_history WHERE order_id=? ORDER BY created_at ASC, rowid ASC`).bind(order.id).all();
    const history = []; let lastLabel = "";
    for (const row of historyRows) {
      const label = displayOrderStatus({ ...order, status: row.status, payment_status: row.payment_status });
      if (label === lastLabel) continue; lastLabel = label;
      const stamp = String(row.created_at || ""), at = /Z|[+-]\d\d:?\d\d$/.test(stamp) ? stamp : stamp.replace(" ", "T") + "Z";
      history.push({ label, at, note: row.payment_status === "rejected" ? String(row.note || "").replace(/^Bukti ditolak:\s*/, "").slice(0, 300) : null });
    }
    const settings = await readStoreSettings(db, env);
    const phoneTo = String(settings.whatsappPhone || env.PUBLIC_WA_PHONE || "6282126014726").replace(/\D/g, "");
    const message = `Halo Sayur Pasundan, saya ingin menanyakan pesanan ${order.order_code}. Status saat ini: ${displayOrderStatus(order)}.`;
    return json({ ok: true, order: { ...order, display_status: displayOrderStatus(order), items, method: method || null,
      latest_proof: proof || null, history, whatsapp_url: `https://wa.me/${phoneTo}?text=${encodeURIComponent(message)}` } });
  } catch (error) {
    console.error("[orders/track] Gagal memuat status pesanan", error);
    return json({ error: "Pelacakan pesanan belum siap. Pastikan migrasi Tahap 2 sudah dijalankan." }, 503);
  }
}
