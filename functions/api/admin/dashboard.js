import { json, requireDb } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

function jakartaStartOfDay() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const data = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return new Date(`${data.year}-${data.month}-${data.day}T00:00:00+07:00`).toISOString();
}
function jakartaStartOfMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const data = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return new Date(`${data.year}-${data.month}-01T00:00:00+07:00`).toISOString();
}
export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  try {
    const db = requireDb(env);
    const today = jakartaStartOfDay();
    const month = jakartaStartOfMonth();
    const [newOrders, verification, daySales, monthSales, products, activeProducts, units, recent] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS count FROM orders WHERE created_at >= ? AND status <> 'cancelled'").bind(today).first(),
      db.prepare("SELECT COUNT(*) AS count FROM orders WHERE payment_status='awaiting_verification'").first(),
      db.prepare("SELECT COALESCE(SUM(total),0) AS total FROM orders WHERE created_at>=? AND payment_status IN ('paid','cod_paid') AND status<>'cancelled'").bind(today).first(),
      db.prepare("SELECT COALESCE(SUM(total),0) AS total FROM orders WHERE created_at>=? AND payment_status IN ('paid','cod_paid') AND status<>'cancelled'").bind(month).first(),
      db.prepare("SELECT COUNT(*) AS count FROM products").first(),
      db.prepare("SELECT COUNT(*) AS count FROM products WHERE lower(status)='active'").first(),
      db.prepare("SELECT COUNT(*) AS count FROM sale_units WHERE lower(status)='active'").first(),
      db.prepare("SELECT order_code,customer_name,total,status,payment_status,payment_method,created_at FROM orders ORDER BY created_at DESC LIMIT 8").all()
    ]);
    return json({ ok: true, metrics: {
      newOrders: Number(newOrders?.count || 0), awaitingVerification: Number(verification?.count || 0),
      salesToday: Number(daySales?.total || 0), salesMonth: Number(monthSales?.total || 0),
      products: Number(products?.count || 0), activeProducts: Number(activeProducts?.count || 0), activeUnits: Number(units?.count || 0)
    }, recentOrders: recent.results || [] });
  } catch (error) {
    console.error("[admin/dashboard]", error);
    return json({ error: "Ringkasan belum tersedia. Pastikan migrasi database sudah dijalankan." }, 503);
  }
}
