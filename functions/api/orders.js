import { json, readJson, requireDb, safeText, numberOr, sameOrigin } from "../_lib/http.js";
import { coordinatesFromGoogleMapsUrl, haversineKm, money, normalizeGoogleMapsUrl, normalizePhone, shippingQuote, validCoordinatePair, expireOverdueOrders } from "../_lib/order-utils.js";
import { codOrderError, readStoreSettings } from "../_lib/store-config.js";

function orderCode() { return `SP-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`; }
function code3() { const n = new Uint32Array(1); crypto.getRandomValues(n); return (n[0] % 999) + 1; }

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  if (!env?.DB) return json({ error: "Database belum tersambung." }, 503);
  const body = await readJson(request);
  if (!body || !safeText(body.customer_name, 120) || !safeText(body.customer_phone, 40) ||
      normalizePhone(body.customer_phone).length < 9 || !safeText(body.customer_address, 500) ||
      !safeText(body.customer_city, 120) || !safeText(body.customer_district, 120) || !safeText(body.customer_province, 120) ||
      !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
    return json({ error: "Lengkapi nama, nomor WhatsApp yang valid, alamat, kota/kabupaten, kecamatan, dan minimal satu barang (maksimal 30 baris)." }, 400);
  }
  const db = requireDb(env);
  let settings;
  try { settings = await readStoreSettings(db, env); } catch { settings = await readStoreSettings(null, env); }
  try { await expireOverdueOrders(db); } catch { /* sweeper terjadwal menjadi sumber utama; lanjutkan order baru */ }

  const mapUrl = normalizeGoogleMapsUrl(body.customer_map_url);
  if (body.customer_map_url && !mapUrl) return json({ error: "Tautan lokasi harus berupa tautan Google Maps yang valid." }, 400);
  let deliveryCoordinates = validCoordinatePair(body.customer_lat, body.customer_lng)
    ? { lat: Number(body.customer_lat), lng: Number(body.customer_lng) }
    : coordinatesFromGoogleMapsUrl(mapUrl || "");

  const methodCode = String(body.payment_method || "").trim().toLowerCase();
  const paymentMethod = await db.prepare(`SELECT * FROM payment_methods WHERE code=? AND is_active=1`).bind(methodCode).first();
  if (!paymentMethod) return json({ error: "Metode pembayaran tidak tersedia. Muat ulang halaman dan pilih metode lain." }, 400);

  const isCod = paymentMethod.kind === "cod" || methodCode === "cod";
  if (isCod && !settings.codEnabled) return json({ error: "COD sedang dinonaktifkan oleh toko." }, 409);

  let subtotal = 0;
  const items = [];
  for (const raw of body.items) {
    const unitId = Number(raw.id_satuan);
    if (!Number.isInteger(unitId) || unitId <= 0) return json({ error: "Salah satu satuan pesanan tidak valid." }, 400);
    const unit = await db.prepare(`SELECT u.*,v.product_id,v.id_varian,v.merk,v.nama_varian,p.name AS product_name,p.status AS product_status,p.stock_mode,p.stock_status,v.status AS variant_status
      FROM sale_units u JOIN variants v ON v.id_varian=u.id_varian JOIN products p ON p.id=v.product_id WHERE u.id_satuan=?`).bind(unitId).first();
    if (!unit || String(unit.status).toLowerCase() !== "active" || String(unit.variant_status).toLowerCase() !== "active" || String(unit.product_status).toLowerCase() !== "active") {
      return json({ error: "Salah satu barang sudah tidak tersedia. Muat ulang katalog." }, 409);
    }
    if (Number(unit.harga) <= 0) return json({ error: `Harga ${unit.product_name} belum diatur.` }, 409);
    if (String(unit.stock_mode || "unlimited").toLowerCase() !== "unlimited") return json({ error: `Mode stok fisik untuk ${unit.product_name} belum diaktifkan pada sistem satuan. Toko harus menggunakan mode unlimited atau menyelesaikan modul stok per satuan terlebih dahulu.` }, 409);

    const nominal = raw.nominal_amount == null || raw.nominal_amount === "" ? null : numberOr(raw.nominal_amount, -1);
    let quantity, lineTotal;
    if (nominal !== null && nominal > 0) {
      if (Number(unit.allow_nominal_purchase) !== 1) return json({ error: `Pembelian nominal tidak diizinkan untuk ${unit.nama_satuan}.` }, 400);
      if (unit.nominal_min != null && nominal < Number(unit.nominal_min)) return json({ error: `Nominal minimum untuk ${unit.nama_satuan} adalah Rp${Number(unit.nominal_min).toLocaleString("id-ID")}.` }, 400);
      lineTotal = money(nominal); quantity = lineTotal / Number(unit.harga);
    } else {
      quantity = numberOr(raw.quantity, 0);
      const step = String(unit.sale_type).toLowerCase() === "measure" ? 0.5 : 1;
      if (quantity <= 0 || quantity > 9999 || Math.abs(quantity / step - Math.round(quantity / step)) > 0.0001) return json({ error: `Jumlah ${unit.nama_satuan} harus kelipatan ${step}.` }, 400);
      lineTotal = money(quantity * Number(unit.harga));
    }
    subtotal = money(subtotal + lineTotal);
    items.push({ id_satuan: unit.id_satuan, product_id: unit.product_id, id_varian: unit.id_varian, product_name: unit.product_name,
      variant_label: [unit.merk, unit.nama_varian].filter(Boolean).join(" "), unit_label: unit.nama_satuan,
      quantity, unit_price: Number(unit.harga), line_total: lineTotal });
  }

  let distanceKm = null;
  if (deliveryCoordinates) distanceKm = haversineKm(deliveryCoordinates.lat, deliveryCoordinates.lng, settings.warehouseLat, settings.warehouseLng);
  let shipping;
  try { shipping = shippingQuote(subtotal, distanceKm, settings); }
  catch (error) { return json({ error: error.message }, 400); }
  const total = money(subtotal + shipping.shipping_fee);
  if (isCod) {
    const codError = codOrderError(settings, {
      district: body.customer_district,
      city: body.customer_city,
      province: body.customer_province,
      hasCoordinates: Boolean(deliveryCoordinates),
      total
    });
    if (codError) return json({ error: codError }, 400);
  }

  if (paymentMethod.kind !== "bank_transfer" && paymentMethod.kind !== "e_wallet" && !isCod) return json({ error: "Jenis metode pembayaran tidak dikenali." }, 400);
  if (!isCod && paymentMethod.kind !== "bank_transfer" && paymentMethod.kind !== "e_wallet") return json({ error: "Metode pembayaran ini belum mendukung transfer manual." }, 400);

  const code = orderCode();
  const now = new Date();
  const due = isCod ? null : new Date(now.getTime() + settings.transferExpiryHours * 60 * 60 * 1000).toISOString();
  const initialStatus = isCod ? "processed" : "pending";
  const initialPaymentStatus = isCod ? "cod_unpaid" : "awaiting_payment";
  const customer = {
    name: safeText(body.customer_name, 120), phone: safeText(body.customer_phone, 40), address: safeText(body.customer_address, 500),
    city: safeText(body.customer_city, 120), district: safeText(body.customer_district, 120), province: safeText(body.customer_province, 120),
    mapUrl: mapUrl || null, notes: safeText(body.notes, 1000)
  };

  const createStatements = (uniqueCode, finalPaymentAmount) => {
    const values = [code, code, customer.name, customer.phone, customer.address, customer.city, customer.district, customer.province,
      deliveryCoordinates?.lat ?? null, deliveryCoordinates?.lng ?? null, customer.mapUrl, customer.notes,
      subtotal, shipping.shipping_fee, distanceKm, total, methodCode, initialPaymentStatus, due, uniqueCode, finalPaymentAmount, initialStatus];
    const stmts = [db.prepare(`INSERT INTO orders (id,order_code,customer_name,customer_phone,customer_address,customer_city,customer_district,customer_province,customer_lat,customer_lng,customer_map_url,notes,subtotal,shipping_fee,distance_km,total,payment_method,payment_status,payment_due_at,payment_unique_code,payment_amount,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...values)];
    for (const item of items) stmts.push(db.prepare(`INSERT INTO order_items (order_id,id_satuan,product_id,id_varian,product_name,variant_label,unit_label,quantity,unit_price,line_total) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(code, item.id_satuan, item.product_id, item.id_varian, item.product_name, item.variant_label, item.unit_label, item.quantity, item.unit_price, item.line_total));
    if (!isCod) stmts.push(db.prepare(`INSERT INTO payment_refs(payment_amount,order_id,expires_at) VALUES(?,?,?)`).bind(finalPaymentAmount, code, due));
    stmts.push(db.prepare(`INSERT INTO order_status_history(order_id,status,payment_status,note,changed_by) VALUES(?,?,?,?, 'customer')`)
      .bind(code, initialStatus, initialPaymentStatus, isCod ? "Pesanan COD dibuat" : "Menunggu pembayaran transfer"));
    return stmts;
  };

  let created = false, lastError = null;
  let chosenCode = 0;
  let paymentAmount = total;
  for (let attempt = 0; attempt < 8 && !created; attempt++) {
    chosenCode = isCod ? 0 : code3();
    paymentAmount = total + chosenCode;
    try { await db.batch(createStatements(chosenCode, paymentAmount)); created = true; }
    catch (error) {
      lastError = error;
      if (isCod || !/unique|constraint/i.test(String(error?.message || error))) break;
    }
  }
  if (!created) { console.error("[orders] Gagal menyimpan pesanan", lastError); return json({ error: "Pesanan belum berhasil disimpan. Silakan coba kembali." }, 500); }

  const paymentMessage = isCod ? "Pembayaran dilakukan saat barang diterima." : `Transfer ${paymentMethod.name} sebesar Rp${paymentAmount.toLocaleString("id-ID")} sebelum ${due}.`;
  let message = `Halo Sayur Pasundan, saya ingin mengonfirmasi pesanan.\n\nKode: ${code}\nNama: ${customer.name}\nNo. WhatsApp: ${customer.phone}\nAlamat: ${customer.address}, ${customer.district}, ${customer.city}, ${customer.province}${customer.mapUrl ? `\nGoogle Maps: ${customer.mapUrl}` : ""}\n\nDetail pesanan:\n`;
  for (const item of items) message += `• ${item.product_name}${item.variant_label ? ` (${item.variant_label})` : ""} — ${item.quantity} × ${item.unit_label} = Rp${item.line_total.toLocaleString("id-ID")}\n`;
  message += `\nSubtotal: Rp${subtotal.toLocaleString("id-ID")}\nOngkir: ${shipping.shipping_fee ? `Rp${shipping.shipping_fee.toLocaleString("id-ID")}` : "Gratis"}\nTotal: Rp${total.toLocaleString("id-ID")}`;
  if (!isCod) message += `\nKode unik: ${String(chosenCode).padStart(3, "0")}\nTotal transfer: Rp${paymentAmount.toLocaleString("id-ID")}`;
  message += `\n${paymentMessage}`;
  if (customer.notes) message += `\n\nCatatan: ${customer.notes}`;
  const storePhone = String(settings.whatsappPhone || env.PUBLIC_WA_PHONE || "6281221031765").replace(/\D/g, "");
  return json({ ok: true, order_code: code, customer_phone: customer.phone, customer_map_url: customer.mapUrl, subtotal, shipping_fee: shipping.shipping_fee,
    distance_km: distanceKm == null ? null : Math.round(distanceKm * 100) / 100, total, payment_method: paymentMethod.name,
    payment_method_code: methodCode, payment_status: initialPaymentStatus, payment_unique_code: chosenCode ? String(chosenCode).padStart(3, "0") : null,
    payment_amount: paymentAmount, payment_due_at: due, account_number: paymentMethod.account_number,
    account_name: paymentMethod.account_name, payment_instructions: paymentMethod.instructions,
    cod_max_order_total: settings.codMaxOrderTotal, whatsapp_url: `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}` });
}
