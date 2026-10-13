import { json, readJson, requireDb, sameOrigin } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { normalizePhone } from "../../_lib/order-utils.js";
import { allowedPushEndpoint, ensureNotifyTables, getVapid, hashEndpoint } from "../../_lib/notify.js";

const MAX_PER_ORDER = 5;

// Mendaftarkan perangkat untuk menerima notifikasi.
//  role "admin"    : wajib sesi admin
//  role "customer" : wajib kode pesanan + nomor WhatsApp yang cocok
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const body = await readJson(request);
  const sub = body?.subscription, role = body?.role === "admin" ? "admin" : "customer";
  const endpoint = String(sub?.endpoint || ""), p256dh = String(sub?.keys?.p256dh || ""), auth = String(sub?.keys?.auth || "");
  if (!endpoint || endpoint.length > 1000 || !allowedPushEndpoint(endpoint, env)) return json({ error: "Perangkat ini tidak didukung untuk notifikasi." }, 400);
  let db;
  try { db = requireDb(env); } catch { return json({ error: "Database belum tersambung." }, 503); }
  try {
    await ensureNotifyTables(db);
    let orderCode = "";
    if (role === "admin") {
      const adminAuth = await requireAdmin(request, env);
      if (!adminAuth.ok) return adminAuth.response;
    } else {
      orderCode = String(body?.order_code || "").trim().toUpperCase();
      const phone = normalizePhone(body?.customer_phone);
      const order = orderCode ? await db.prepare(`SELECT order_code,customer_phone FROM orders WHERE order_code=?`).bind(orderCode).first() : null;
      if (!order || phone.length < 9 || normalizePhone(order.customer_phone) !== phone) return json({ error: "Pesanan tidak ditemukan." }, 404);
      const count = await db.prepare(`SELECT COUNT(*) AS n FROM push_subscriptions WHERE role='customer' AND order_code=?`).bind(orderCode).first();
      const hash0 = await hashEndpoint(endpoint);
      const exists = await db.prepare(`SELECT hash FROM push_subscriptions WHERE hash=? AND role='customer' AND order_code=?`).bind(hash0, orderCode).first();
      if (!exists && Number(count?.n || 0) >= MAX_PER_ORDER) return json({ error: "Jumlah perangkat untuk pesanan ini sudah maksimal." }, 429);
    }
    const hash = await hashEndpoint(endpoint);
    await getVapid(db, new URL(request.url).origin);
    await db.prepare(`INSERT INTO push_subscriptions(hash,role,order_code,endpoint,p256dh,auth) VALUES(?,?,?,?,?,?)
      ON CONFLICT(hash,role,order_code) DO UPDATE SET endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth=excluded.auth`)
      .bind(hash, role, orderCode, endpoint, p256dh, auth).run();
    return json({ ok: true }, 201);
  } catch (error) {
    console.error("[push/subscribe]", error?.message || error);
    return json({ error: "Notifikasi belum dapat diaktifkan." }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  const body = await readJson(request);
  const endpoint = String(body?.endpoint || "");
  if (!endpoint) return json({ error: "Endpoint wajib." }, 400);
  try {
    const db = requireDb(env); await ensureNotifyTables(db);
    const hash = await hashEndpoint(endpoint);
    await db.prepare(`DELETE FROM push_subscriptions WHERE hash=?`).bind(hash).run();
    await db.prepare(`DELETE FROM push_messages WHERE hash=?`).bind(hash).run();
    return json({ ok: true });
  } catch (error) { return json({ error: "Gagal menonaktifkan notifikasi." }, 500); }
}
