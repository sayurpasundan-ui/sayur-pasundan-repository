import { emit } from "./notify.js";
const STORE_LAT = -7.059522;
const STORE_LNG = 107.764035;
const FREE_SHIPPING_MIN = 50000;
const NEAR_RADIUS_KM = 3;
const NEAR_SHIPPING = 5000;
const FAR_SHIPPING = 10000;

export const money = (value) => Math.round(Number(value) + Number.EPSILON);
export const digits = (value) => String(value ?? "").replace(/\D/g, "");
export const normalizePhone = (value) => {
  let phone = digits(value);
  if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
  if (phone.startsWith("8")) phone = `62${phone}`;
  return phone;
};
export const normalizePlace = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
export function validCoordinatePair(lat, lng) {
  return lat !== null && lat !== undefined && String(lat).trim() !== "" && lng !== null && lng !== undefined && String(lng).trim() !== "" &&
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat) >= -90 && Number(lat) <= 90 && Number(lng) >= -180 && Number(lng) <= 180;
}
export function haversineKm(lat1, lng1, lat2 = STORE_LAT, lng2 = STORE_LNG) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function normalizeGoogleMapsUrl(value) {
  const input = String(value ?? "").trim();
  if (!input) return "";
  if (input.length > 1000) return null;
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    const allowed = host === "google.com" || host.endsWith(".google.com") || host === "maps.app.goo.gl" || host === "goo.gl" || host === "earth.google.com";
    if (!allowed || !["http:", "https:"].includes(url.protocol)) return null;
    return url.href;
  } catch { return null; }
}

export function coordinatesFromGoogleMapsUrl(value) {
  const url = normalizeGoogleMapsUrl(value);
  if (!url) return null;
  const decoded = decodeURIComponent(url.replace(/\+/g, "%20"));
  const patterns = [
    /@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|query|ll|center)=(-?\d{1,2}(?:\.\d+)?)[,%2C ]+(-?\d{1,3}(?:\.\d+)?)/i
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match && validCoordinatePair(match[1], match[2])) return { lat: Number(match[1]), lng: Number(match[2]) };
  }
  return null;
}

export function shippingQuote(subtotal, distanceKm, config = {}) {
  const freeMinimum = Number.isFinite(Number(config.freeShippingMinimum)) ? Number(config.freeShippingMinimum) : FREE_SHIPPING_MIN;
  const nearRadius = Number.isFinite(Number(config.nearRadiusKm)) ? Number(config.nearRadiusKm) : NEAR_RADIUS_KM;
  const nearFee = Number.isFinite(Number(config.nearShippingFee)) ? Number(config.nearShippingFee) : NEAR_SHIPPING;
  const farFee = Number.isFinite(Number(config.farShippingFee)) ? Number(config.farShippingFee) : FAR_SHIPPING;
  if (subtotal >= freeMinimum) return { shipping_fee: 0, reason: `Gratis ongkir untuk subtotal minimal Rp${freeMinimum.toLocaleString("id-ID")}.` };
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new Error(`Lokasi pengantaran diperlukan untuk menghitung ongkir pesanan di bawah Rp${freeMinimum.toLocaleString("id-ID")}.`);
  return { shipping_fee: distanceKm <= nearRadius ? nearFee : farFee, reason: distanceKm <= nearRadius ? `Jarak maksimal ${nearRadius} km.` : `Jarak di atas ${nearRadius} km.` };
}
export function allowedCodDistricts(env, settings = null) {
  const source = settings?.raw?.cod_allowed_districts ?? env?.COD_ALLOWED_DISTRICTS ?? "";
  return String(source).split(",").map(normalizePlace).filter(Boolean);
}
export function displayOrderStatus(order) {
  if (order.status === "cancelled" || order.payment_status === "expired") return "Pesanan dibatalkan";
  if (order.payment_status === "awaiting_payment") return "Menunggu Pembayaran";
  if (order.payment_status === "awaiting_verification") return "Menunggu Verifikasi Pembayaran";
  if (order.payment_status === "rejected") return "Bukti Pembayaran Ditolak";
  if (order.payment_status === "cod_unpaid") return order.status === "delivering" ? "Sedang Dikirim · Pembayaran saat tiba" : "Diproses · Bayar saat tiba";
  if (order.status === "pending") return "Menunggu Konfirmasi";
  if (order.status === "processed") return "Diproses";
  if (order.status === "delivering") return "Dikirim";
  if (order.status === "completed") return order.payment_method === "cod" ? "Selesai · COD diterima" : "Selesai";
  return "Pesanan diterima";
}

export async function expireOverdueOrders(db, notifyCtx = null) {
  const cutoff = new Date().toISOString();
  const { results = [] } = await db.prepare(`SELECT id,order_code,customer_name,total,payment_method FROM orders
    WHERE payment_status IN ('awaiting_payment','rejected') AND payment_due_at IS NOT NULL AND payment_due_at <= ?
      AND status <> 'cancelled' LIMIT 100`).bind(cutoff).all();
  let expired = 0;
  for (const order of results) {
    // Conditional update prevents a concurrent payment verification from being overwritten.
    const changedAt = new Date().toISOString();
    const updated = await db.prepare(`UPDATE orders SET status='cancelled',payment_status='expired',cancelled_at=?,cancellation_reason='Batas pembayaran 24 jam terlewati',updated_at=?
      WHERE id=? AND payment_status IN ('awaiting_payment','rejected') AND payment_due_at<=? AND status <> 'cancelled'`)
      .bind(changedAt, changedAt, order.id, cutoff).run();
    if (Number(updated?.meta?.changes || 0) < 1) continue;
    await db.batch([
      db.prepare(`DELETE FROM payment_refs WHERE order_id=?`).bind(order.id),
      db.prepare(`INSERT INTO order_status_history(order_id,status,payment_status,note,changed_by) VALUES(?,'cancelled','expired','Batas pembayaran terlewati','system')`).bind(order.id)
    ]);
    expired++;
    if (notifyCtx?.env) { const pending = emit(notifyCtx, { type: "order_expired", order }); if (typeof notifyCtx.waitUntil !== "function") await pending; }
  }
  return expired;
}
