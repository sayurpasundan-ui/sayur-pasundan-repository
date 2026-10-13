import { json, requireDb, sameOrigin } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { channelStatus, ensureNotifyTables, getVapid, notifyEvent } from "../../_lib/notify.js";

// GET  : status saluran notifikasi
// POST : kirim notifikasi uji ke semua saluran admin
export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  try { return json(await channelStatus(env)); }
  catch (error) { console.error("[admin/notify]", error?.message || error); return json({ error: "Status notifikasi belum dapat dimuat." }, 503); }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  try {
    const db = requireDb(env); await ensureNotifyTables(db); await getVapid(db, new URL(request.url).origin);
    const result = await notifyEvent(env, { type: "order_created", order: { order_code: "SP-TES", customer_name: "Uji notifikasi", total: 0, payment_method: "tes" } });
    return json({ ok: true, result, status: await channelStatus(env) });
  } catch (error) { console.error("[admin/notify:test]", error?.message || error); return json({ error: "Notifikasi uji gagal dikirim." }, 500); }
}
