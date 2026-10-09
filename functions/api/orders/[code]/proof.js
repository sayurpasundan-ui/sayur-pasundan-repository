import { json, requireDb, sameOrigin } from "../../../_lib/http.js";
import { expireOverdueOrders, normalizePhone } from "../../../_lib/order-utils.js";

const MAX_BYTES = 2 * 1024 * 1024;
const MIME_EXT = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
function validMagic(type, bytes) {
  if (type === "image/jpeg") return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (type === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  return false;
}

export async function onRequestPost({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  if (!env?.DB) return json({ error: "Database belum tersambung." }, 503);
  if (!env?.PAYMENT_PROOFS) return json({ error: "Penyimpanan bukti pembayaran belum dikonfigurasi. Hubungi admin toko." }, 503);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES + 65536) return json({ error: "Ukuran unggahan melebihi batas 2 MB." }, 413);
  let form;
  try { form = await request.formData(); } catch { return json({ error: "Formulir unggahan tidak valid." }, 400); }
  const phone = normalizePhone(form.get("customer_phone"));
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) return json({ error: "Pilih bukti pembayaran terlebih dahulu." }, 400);
  if (file.size > MAX_BYTES) return json({ error: "Ukuran bukti pembayaran maksimal 2 MB." }, 413);
  if (!MIME_EXT[file.type]) return json({ error: "Format bukti pembayaran harus JPG, PNG, atau PDF." }, 415);
  if (phone.length < 9) return json({ error: "Nomor WhatsApp tidak valid." }, 400);

  const db = requireDb(env), code = String(params.code || "").toUpperCase();
  try {
    await expireOverdueOrders(db);
    const order = await db.prepare(`SELECT id,order_code,customer_phone,payment_method,payment_status,payment_due_at,status FROM orders WHERE order_code=?`).bind(code).first();
    if (!order || normalizePhone(order.customer_phone) !== phone) return json({ error: "Pesanan tidak ditemukan. Periksa kode dan nomor WhatsApp." }, 404);
    if (order.payment_method === "cod") return json({ error: "Pesanan COD tidak membutuhkan bukti transfer." }, 400);
    if (order.payment_status === "expired" || order.status === "cancelled" || (order.payment_due_at && Date.parse(order.payment_due_at) <= Date.now())) return json({ error: "Batas pembayaran sudah terlewati. Pesanan tidak dapat menerima bukti baru." }, 410);
    if (!new Set(["awaiting_payment", "rejected"]).has(order.payment_status)) return json({ error: "Pesanan sedang menunggu verifikasi atau sudah dibayar; bukti baru tidak dapat diunggah." }, 409);

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validMagic(file.type, bytes)) return json({ error: "Isi berkas tidak sesuai dengan format JPG, PNG, atau PDF." }, 415);
    const ext = MIME_EXT[file.type], objectKey = `payment-proofs/${order.order_code}/${crypto.randomUUID()}.${ext}`;
    await env.PAYMENT_PROOFS.put(objectKey, bytes, { httpMetadata: { contentType: file.type, cacheControl: "private, no-store" }, customMetadata: { orderCode: order.order_code } });
    try {
      await db.batch([
        db.prepare(`INSERT INTO payment_proofs(order_id,object_key,original_name,mime_type,size_bytes,status) VALUES(?,?,?,?,?,'pending')`)
          .bind(order.id, objectKey, String(file.name || `bukti.${ext}`).replace(/[\r\n\\/]/g, "_").slice(0, 180), file.type, file.size),
        db.prepare(`UPDATE orders SET payment_status='awaiting_verification',updated_at=? WHERE id=? AND payment_status IN ('awaiting_payment','rejected')`)
          .bind(new Date().toISOString(), order.id),
        db.prepare(`INSERT INTO order_status_history(order_id,status,payment_status,note,changed_by) VALUES(?,?,'awaiting_verification','Bukti pembayaran diunggah; menunggu verifikasi','customer')`)
          .bind(order.id, order.status)
      ]);
    } catch (error) {
      await env.PAYMENT_PROOFS.delete(objectKey).catch(() => {});
      throw error;
    }
    return json({ ok: true, message: "Bukti berhasil diunggah dan menunggu verifikasi admin." }, 201);
  } catch (error) {
    console.error("[orders/proof] Gagal menyimpan bukti pembayaran", error);
    return json({ error: "Bukti pembayaran belum dapat disimpan. Coba lagi atau hubungi toko." }, 503);
  }
}
