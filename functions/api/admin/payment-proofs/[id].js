import { json, requireDb } from "../../../_lib/http.js";
import { requireAdmin } from "../../../_lib/auth.js";

export async function onRequestGet({ request, env, params }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!env?.DB) return json({ error: "Database belum tersambung." }, 503);
  if (!env?.PAYMENT_PROOFS) return json({ error: "Binding R2 PAYMENT_PROOFS belum dipasang." }, 503);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "ID bukti tidak valid." }, 400);
  try {
    const proof = await requireDb(env).prepare(`SELECT object_key,original_name,mime_type FROM payment_proofs WHERE id=?`).bind(id).first();
    if (!proof) return json({ error: "Bukti pembayaran tidak ditemukan." }, 404);
    const object = await env.PAYMENT_PROOFS.get(proof.object_key);
    if (!object) return json({ error: "File bukti tidak ditemukan di penyimpanan." }, 404);
    return new Response(object.body, { headers: {
      "content-type": proof.mime_type,
      "content-disposition": `inline; filename="${String(proof.original_name || "bukti-pembayaran").replace(/[\r\n"\\]/g, "_")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox"
    } });
  } catch (error) {
    console.error("[admin/payment-proofs/:id] Gagal membuka bukti", error);
    return json({ error: "Bukti pembayaran belum dapat dibuka." }, 503);
  }
}
