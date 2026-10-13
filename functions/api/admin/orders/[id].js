import { json, readJson, requireDb, sameOrigin } from "../../../_lib/http.js";
import { requireAdmin } from "../../../_lib/auth.js";
import { emit } from "../../../_lib/notify.js";

const ORDER_STATUSES = new Set(["pending", "processed", "delivering", "completed", "cancelled"]);

export async function onRequestPatch({ request, env, params, waitUntil }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  if (!env?.DB) return json({ error: "Database belum tersambung." }, 503);
  const body = await readJson(request);
  const code = String(params.id || "").toUpperCase();
  const db = requireDb(env);
  try {
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
    if (status === "cancelled" && ["paid", "cod_paid"].includes(order.payment_status)) return json({ error: "Pesanan yang telah dibayar tidak dapat dibatalkan dari panel ini. Proses pengembalian dana harus ditangani terpisah." }, 409);
    const paymentStatus = status === "cancelled" ? "cancelled" : order.payment_status;
    await db.batch([
      db.prepare(`UPDATE orders SET status=?,payment_status=?,cancelled_at=?,cancellation_reason=?,updated_at=? WHERE id=?`)
        .bind(status, paymentStatus, status === "cancelled" ? now : order.cancelled_at, status === "cancelled" ? "Dibatalkan oleh admin" : order.cancellation_reason, now, order.id),
      db.prepare(`DELETE FROM payment_refs WHERE order_id=? AND ? IN ('cancelled','completed')`).bind(order.id, status),
      db.prepare(`INSERT INTO order_status_history(order_id,status,payment_status,note,changed_by) VALUES(?,?,?,?, 'admin')`).bind(order.id, status, paymentStatus, `Status pesanan diubah menjadi ${status}`)
    ]);
    if (status !== order.status) emit({ env, waitUntil }, { type: { processed: "status_processed", delivering: "status_delivering", completed: "status_completed", cancelled: "order_cancelled" }[status], order });
    return json({ ok: true, message: "Status pesanan diperbarui." });
  } catch (error) {
    console.error("[admin/orders/:id] Gagal memperbarui pesanan", error);
    return json({ error: "Perubahan pesanan gagal disimpan." }, 500);
  }
}
