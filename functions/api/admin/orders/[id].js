import { json, readJson, requireDb, sameOrigin } from "../../../_lib/http.js";
import { requireAdmin } from "../../../_lib/auth.js";
import { emit } from "../../../_lib/notify.js";
import { expireOverdueOrders, money } from "../../../_lib/order-utils.js";

const ORDER_STATUSES = new Set(["pending", "processed", "delivering", "completed", "cancelled"]);
// Alasan resmi pembatalan/retur. Pesanan yang sudah dikirim (atau selesai) WAJIB memakai salah satunya.
const CANCEL_REASONS = {
  customer_absent: "Customer tidak ada di rumah",
  damaged: "Barang rusak",
  not_as_described: "Barang tidak sesuai pesanan",
  out_of_stock: "Barang kosong",
  unreachable: "Customer tidak dapat dihubungi",
  address_not_found: "Alamat tidak ditemukan"
};

export async function onRequestPatch({ request, env, params, waitUntil }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  if (!env?.DB) return json({ error: "Database belum tersambung." }, 503);
  const body = await readJson(request);
  const code = String(params.id || "").toUpperCase();
  const db = requireDb(env);
  try {
    try { await expireOverdueOrders(db, { env, waitUntil }); } catch (error) { console.error("[admin/orders/:id] sweeper gagal", error); }
    const order = await db.prepare(`SELECT * FROM orders WHERE order_code=?`).bind(code).first();
    if (!order) return json({ error: "Pesanan tidak ditemukan." }, 404);
    const now = new Date().toISOString();
    const action = String(body?.payment_action || "").trim();

    if (action === "verify_payment") {
      if (order.payment_status !== "awaiting_verification") return json({ error: "Pesanan belum menunggu verifikasi pembayaran." }, 409);
      const proof = await db.prepare(`SELECT id FROM payment_proofs WHERE order_id=? AND status='pending' ORDER BY uploaded_at DESC LIMIT 1`).bind(order.id).first();
      if (!proof) return json({ error: "Tidak ada bukti pembayaran yang menunggu verifikasi." }, 409);
      await db.batch([
        db.prepare(`UPDATE payment_proofs SET status='verified',reviewed_at=?,review_note=NULL WHERE id=?`).bind(now, proof.id),
        db.prepare(`UPDATE orders SET payment_status='paid',paid_at=?,status='processed',updated_at=? WHERE id=?`).bind(now, now, order.id),
        db.prepare(`DELETE FROM payment_refs WHERE order_id=?`).bind(order.id),
        db.prepare(`INSERT INTO order_status_history(order_id,status,payment_status,note,changed_by) VALUES(?,'processed','paid','Pembayaran diverifikasi admin','admin')`).bind(order.id)
      ]);
      emit({ env, waitUntil }, { type: "payment_verified", order });
      return json({ ok: true, message: "Pembayaran terverifikasi. Pesanan masuk tahap diproses." });
    }
    if (action === "reject_payment") {
      if (order.payment_status !== "awaiting_verification") return json({ error: "Pesanan belum menunggu verifikasi pembayaran." }, 409);
      const proof = await db.prepare(`SELECT id FROM payment_proofs WHERE order_id=? AND status='pending' ORDER BY uploaded_at DESC LIMIT 1`).bind(order.id).first();
      if (!proof) return json({ error: "Tidak ada bukti pembayaran yang menunggu verifikasi." }, 409);
      const note = String(body?.review_note || "Bukti pembayaran perlu diperiksa kembali.").trim().slice(0, 300);
      await db.batch([
        db.prepare(`UPDATE payment_proofs SET status='rejected',reviewed_at=?,review_note=? WHERE id=?`).bind(now, note, proof.id),
        db.prepare(`UPDATE orders SET payment_status='rejected',updated_at=? WHERE id=?`).bind(now, order.id),
        db.prepare(`INSERT INTO order_status_history(order_id,status,payment_status,note,changed_by) VALUES(?,?,?,'Bukti ditolak: ' || ?,'admin')`).bind(order.id, order.status, "rejected", note)
      ]);
      emit({ env, waitUntil }, { type: "payment_rejected", order, note });
      return json({ ok: true, message: "Bukti ditolak. Pelanggan dapat mengunggah ulang selama batas pembayaran belum lewat." });
    }
    if (action === "cod_paid") {
      if (order.payment_method !== "cod" || order.status !== "delivering" || order.payment_status !== "cod_unpaid") return json({ error: "Pembayaran COD hanya dapat ditandai diterima saat pesanan dikirim dan belum dibayar." }, 409);
      await db.batch([
        db.prepare(`UPDATE orders SET payment_status='cod_paid',paid_at=?,cod_paid_at=?,updated_at=? WHERE id=?`).bind(now, now, now, order.id),
        db.prepare(`INSERT INTO order_status_history(order_id,status,payment_status,note,changed_by) VALUES(?,'delivering','cod_paid','Pembayaran COD diterima admin','admin')`).bind(order.id)
      ]);
      emit({ env, waitUntil }, { type: "cod_paid", order });
      return json({ ok: true, message: "Pembayaran COD diterima." });
    }

    const status = String(body?.status || "");
    if (!ORDER_STATUSES.has(status)) return json({ error: "Status pesanan tidak valid." }, 400);
    if (status === "processed" || status === "delivering" || status === "completed") {
      if (order.payment_method === "cod") {
        if (status === "processed" && order.payment_status !== "cod_unpaid") return json({ error: "Status COD tidak konsisten." }, 409);
        if (status === "completed" && order.payment_status !== "cod_paid") return json({ error: "Tandai pembayaran COD diterima sebelum menyelesaikan pesanan." }, 409);
        if (status === "delivering" && !["cod_unpaid", "cod_paid"].includes(order.payment_status)) return json({ error: "Status pembayaran COD tidak valid." }, 409);
      } else if (order.payment_status !== "paid" && status !== "processed") {
        return json({ error: "Pembayaran transfer harus diverifikasi sebelum pesanan dikirim atau diselesaikan." }, 409);
      } else if (order.payment_method !== "legacy" && order.payment_status !== "paid") {
        return json({ error: "Verifikasi pembayaran sebelum memproses pesanan." }, 409);
      }
    }
    const alreadyCancelled = order.status === "cancelled" || order.payment_status === "expired";
    if (alreadyCancelled && status !== "cancelled") return json({ error: "Pesanan yang sudah dibatalkan tidak dapat diaktifkan kembali. Minta pelanggan membuat pesanan baru." }, 409);

    if (status === "cancelled") {
      // Pelanggan tidak punya endpoint pembatalan; pembatalan/retur hanya lewat admin.
      if (alreadyCancelled) return json({ ok: true, message: "Pesanan sudah dibatalkan sebelumnya." });
      const reasonCode = String(body?.cancel_reason_code || "").trim();
      const reasonNote = String(body?.cancel_reason_note || "").trim().slice(0, 300);
      if (reasonCode && !CANCEL_REASONS[reasonCode]) return json({ error: "Alasan pembatalan tidak dikenali." }, 400);
      const lateStage = ["delivering", "completed"].includes(order.status);
      if (lateStage && !reasonCode) return json({ error: "Pesanan yang sudah dikirim hanya dapat dibatalkan/diretur dengan salah satu alasan: customer tidak ada di rumah, tidak dapat dihubungi, alamat tidak ditemukan, barang rusak, barang tidak sesuai, atau barang kosong." }, 400);
      const label = reasonCode ? CANCEL_REASONS[reasonCode] : "Dibatalkan oleh admin";
      const reason = reasonNote ? `${label} — ${reasonNote}` : label;
      // Uang yang sudah diterima (transfer terverifikasi / COD diterima) dicatat sebagai pengurang penerimaan.
      const wasPaid = ["paid", "cod_paid"].includes(order.payment_status);
      const refundAmount = wasPaid ? money(order.total) : 0;
      const returnedAt = lateStage || wasPaid ? now : null;
      const historyNote = `${lateStage ? "Retur/dibatalkan" : "Dibatalkan"} admin: ${reason}${refundAmount ? ` · pengurang penerimaan ${refundAmount}` : ""}`;
      try {
        await db.batch([
          db.prepare(`UPDATE orders SET status='cancelled',payment_status='cancelled',cancelled_at=?,cancellation_reason=?,cancel_reason_code=?,cancelled_stage=?,refund_amount=?,returned_at=?,updated_at=? WHERE id=? AND status<>'cancelled'`)
            .bind(now, reason, reasonCode || null, order.status, refundAmount, returnedAt, now, order.id),
          db.prepare(`UPDATE payment_proofs SET status='rejected',reviewed_at=?,review_note='Pesanan dibatalkan' WHERE order_id=? AND status='pending'`).bind(now, order.id),
          db.prepare(`DELETE FROM payment_refs WHERE order_id=?`).bind(order.id),
          db.prepare(`INSERT INTO order_status_history(order_id,status,payment_status,note,changed_by) VALUES(?,'cancelled','cancelled',?,'admin')`).bind(order.id, historyNote.slice(0, 400))
        ]);
      } catch (error) {
        if (/no such column|has no column/i.test(String(error?.message || error))) return json({ error: "Kolom pembatalan/retur belum ada. Jalankan migrasi database 0011_cancel_return.sql terlebih dahulu." }, 503);
        throw error;
      }
      emit({ env, waitUntil }, { type: "order_cancelled", order, note: reason });
      return json({ ok: true, message: refundAmount ? `Pesanan dibatalkan/diretur. Penerimaan dikurangi Rp${refundAmount.toLocaleString("id-ID")}; kembalikan dana ke pelanggan secara manual.` : "Pesanan dibatalkan." });
    }

    await db.batch([
      db.prepare(`UPDATE orders SET status=?,updated_at=? WHERE id=?`).bind(status, now, order.id),
      db.prepare(`DELETE FROM payment_refs WHERE order_id=? AND ?='completed'`).bind(order.id, status),
      db.prepare(`INSERT INTO order_status_history(order_id,status,payment_status,note,changed_by) VALUES(?,?,?,?, 'admin')`).bind(order.id, status, order.payment_status, `Status pesanan diubah menjadi ${status}`)
    ]);
    if (status !== order.status) emit({ env, waitUntil }, { type: { processed: "status_processed", delivering: "status_delivering", completed: "status_completed" }[status], order });
    return json({ ok: true, message: "Status pesanan diperbarui." });
  } catch (error) {
    console.error("[admin/orders/:id] Gagal memperbarui pesanan", error);
    return json({ error: "Perubahan pesanan gagal disimpan." }, 500);
  }
}
