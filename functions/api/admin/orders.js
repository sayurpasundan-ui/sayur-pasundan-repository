import { json, requireDb } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  try {
    const db = requireDb(env);
    const { results = [] } = await db.prepare(`SELECT o.id,o.order_code,o.customer_name,o.customer_phone,o.customer_address,o.customer_city,o.customer_district,o.customer_province,o.customer_lat,o.customer_lng,o.customer_map_url,o.notes,
      o.subtotal,o.shipping_fee,o.distance_km,o.total,o.payment_method,o.payment_status,o.payment_unique_code,o.payment_amount,o.payment_due_at,o.paid_at,o.cod_paid_at,
      o.status,o.created_at,o.updated_at,pm.name AS payment_method_name,
      (SELECT pp.id FROM payment_proofs pp WHERE pp.order_id=o.id ORDER BY pp.uploaded_at DESC LIMIT 1) AS latest_proof_id,
      (SELECT pp.status FROM payment_proofs pp WHERE pp.order_id=o.id ORDER BY pp.uploaded_at DESC LIMIT 1) AS latest_proof_status
      FROM orders o LEFT JOIN payment_methods pm ON pm.code=o.payment_method ORDER BY o.created_at DESC LIMIT 1000`).all();
    for (const order of results) {
      const items = await db.prepare(`SELECT product_name,variant_label,unit_label,quantity,unit_price,line_total FROM order_items WHERE order_id=? ORDER BY id`).bind(order.id).all();
      order.items = items.results || [];
    }
    return json(results);
  } catch (error) {
    console.error("[admin/orders] Gagal memuat pesanan", error);
    return json({ error: "Pesanan belum dapat dimuat. Pastikan migrasi Tahap 2 sudah dijalankan." }, 503);
  }
}
