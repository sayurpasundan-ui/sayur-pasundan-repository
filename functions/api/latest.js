import { json, requireDb } from "../../_lib/http.js";
import { ensureNotifyTables } from "../../_lib/notify.js";

// Dipanggil service worker saat ada push: mengambil pesan terlama yang belum ditampilkan untuk perangkat ini.
// "h" = SHA-256 endpoint langganan (hanya diketahui perangkat itu sendiri).
export async function onRequestGet({ request, env }) {
  const hash = String(new URL(request.url).searchParams.get("h") || "");
  if (!/^[a-f0-9]{64}$/.test(hash)) return json({});
  try {
    const db = requireDb(env); await ensureNotifyTables(db);
    await db.prepare(`DELETE FROM push_messages WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')`).run();
    const row = await db.prepare(`SELECT id,title,body,url FROM push_messages WHERE hash=? ORDER BY id ASC LIMIT 1`).bind(hash).first();
    if (!row) return json({});
    await db.prepare(`DELETE FROM push_messages WHERE id=?`).bind(row.id).run();
    return json({ title: row.title, body: row.body, url: row.url, tag: `sp-${row.id}` });
  } catch { return json({}); }
}
