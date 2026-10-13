import { json, requireDb } from "../../../_lib/http.js";
import { requireAdmin } from "../../../_lib/auth.js";
import { D1_KEY_PREFIX, base64ToBytes, ensureProofTable } from "../../../_lib/proof-storage.js";

export async function onRequestGet({ request, env, params }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!env?.DB) return json({ error: "Database belum tersambung." }, 503);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "ID bukti tidak valid." }, 400);
  try {
    const proof = await requireDb(env).prepare(`SELECT object_key,original_name,mime_type FROM payment_proofs WHERE id=?`).bind(id).first();
    if (!proof) return json({ error: "Bukti pembayaran tidak ditemukan." }, 404);
    let body;
    if (String(proof.object_key).startsWith(D1_KEY_PREFIX)) {
      await ensureProofTable(requireDb(env));
      const row = await requireDb(env).prepare(`SELECT data_base64 FROM payment_proof_files WHERE object_key=?`).bind(proof.object_key).first();
      if (!row) return json({ error: "File bukti tidak ditemukan di penyimpanan." }, 404);
      body = base64ToBytes(row.data_base64);
    } else {
      if (!env?.PAYMENT_PROOFS) return json({ error: "Binding R2 PAYMENT_PROOFS belum dipasang." }, 503);
      const object = await env.PAYMENT_PROOFS.get(proof.object_key);
      if (!object) return json({ error: "File bukti tidak ditemukan di penyimpanan." }, 404);
      body = object.body;
    }
    return new Response(body, { headers: {
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
