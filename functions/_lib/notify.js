// Notifikasi otomatis Sayur Pasundan.
//
// Saluran (semua opsional, gagal satu tidak mengganggu pesanan):
//  - Web Push ke HP admin dan HP pelanggan (tanpa biaya, tanpa akun pihak ketiga).
//    Kunci VAPID dibuat otomatis dan disimpan di D1 (tabel notify_config).
//  - Telegram ke admin   : secret TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
//  - Email ke admin      : secret ADMIN_NOTIFY_EMAIL + RESEND_API_KEY (+ RESEND_FROM_EMAIL)
//
// Tabel dibuat otomatis (CREATE TABLE IF NOT EXISTS); lihat juga migrations/0009_notifications.sql.

const enc = new TextEncoder();
const PUSH_HOST_SUFFIXES = ["fcm.googleapis.com", "push.services.mozilla.com", "notify.windows.com", "push.apple.com"];
const RESEND_URL = "https://api.resend.com/emails";
let tablesReady = false;

export function b64u(bytes) {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64u(text) {
  const pad = "=".repeat((4 - (text.length % 4)) % 4);
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
export async function hashEndpoint(endpoint) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(String(endpoint)));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureNotifyTables(db) {
  if (tablesReady) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS notify_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    hash TEXT NOT NULL, role TEXT NOT NULL, order_code TEXT NOT NULL DEFAULT '', endpoint TEXT NOT NULL,
    p256dh TEXT, auth TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (hash, role, order_code))`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_target ON push_subscriptions(role, order_code)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS push_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT NOT NULL DEFAULT '/',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_push_messages_hash ON push_messages(hash, id)`).run();
  tablesReady = true;
}

async function getConfig(db, key) {
  const row = await db.prepare(`SELECT value FROM notify_config WHERE key=?`).bind(key).first();
  return row ? row.value : null;
}
async function setConfigIfMissing(db, key, value) {
  await db.prepare(`INSERT OR IGNORE INTO notify_config(key,value) VALUES(?,?)`).bind(key, value).run();
}

// Kunci VAPID dibuat sekali, lalu dipakai terus.
export async function getVapid(db, origin) {
  await ensureNotifyTables(db);
  let raw = await getConfig(db, "vapid_jwk");
  if (!raw) {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    await setConfigIfMissing(db, "vapid_jwk", JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey)));
    raw = await getConfig(db, "vapid_jwk");
  }
  if (origin) await setConfigIfMissing(db, "site_origin", origin);
  const jwk = JSON.parse(raw);
  const publicKey = b64u(new Uint8Array([4, ...unb64u(jwk.x), ...unb64u(jwk.y)]));
  return { jwk, publicKey, siteOrigin: await getConfig(db, "site_origin") };
}

async function vapidJwt(jwk, audience, subject) {
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64u(sig)}`;
}

export function allowedPushEndpoint(endpoint, env) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && !env?.PUSH_TEST_ALLOW_HOSTS) return false;
    const extra = String(env?.PUSH_TEST_ALLOW_HOSTS || "").split(",").map(s => s.trim()).filter(Boolean);
    return [...PUSH_HOST_SUFFIXES, ...extra].some(h => url.hostname === h || url.hostname.endsWith("." + h));
  } catch { return false; }
}

// Push tanpa payload: pesan disimpan di D1 dan diambil service worker lewat /api/push/latest.
async function sendPush(db, env, sub, message) {
  await db.prepare(`INSERT INTO push_messages(hash,title,body,url) VALUES(?,?,?,?)`).bind(sub.hash, message.title, message.body, message.url || "/").run();
  const vapid = await getVapid(db);
  const target = new URL(sub.endpoint);
  const subject = vapid.siteOrigin && vapid.siteOrigin.startsWith("https://") ? vapid.siteOrigin : "mailto:admin@sayurpasundan.example";
  const jwt = await vapidJwt(vapid.jwk, target.origin, subject);
  const res = await fetch(sub.endpoint, { method: "POST", headers: { Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`, TTL: "86400", Urgency: "high" } });
  if (res.status === 404 || res.status === 410) {
    await db.prepare(`DELETE FROM push_subscriptions WHERE hash=?`).bind(sub.hash).run();
    await db.prepare(`DELETE FROM push_messages WHERE hash=?`).bind(sub.hash).run();
    return { ok: false, status: res.status, removed: true };
  }
  if (!res.ok) {
    await db.prepare(`DELETE FROM push_messages WHERE hash=? AND title=? AND body=?`).bind(sub.hash, message.title, message.body).run();
    return { ok: false, status: res.status };
  }
  return { ok: true, status: res.status };
}

async function pushTo(db, env, subs, message) {
  const out = { sent: 0, failed: 0 };
  for (const sub of subs) {
    try { (await sendPush(db, env, sub, message)).ok ? out.sent++ : out.failed++; }
    catch (error) { out.failed++; console.error("[notify] push gagal", error?.message || error); }
  }
  return out;
}

async function sendTelegram(env, text) {
  const token = String(env?.TELEGRAM_BOT_TOKEN || "").trim(), chat = String(env?.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chat) return { skipped: true, missing: [!token && "TELEGRAM_BOT_TOKEN", !chat && "TELEGRAM_CHAT_ID"].filter(Boolean) };
  const base = String(env?.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/$/, "");
  const res = await fetch(`${base}/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }) });
  return res.ok ? { ok: true } : { ok: false, status: res.status, error: await readErrorMessage(res) };
}

async function readErrorMessage(res) {
  const text = await res.text().catch(() => "");
  try { const data = JSON.parse(text); return String(data.message || data.error?.message || data.error || "").slice(0, 240); } catch { return text.slice(0, 240); }
}

async function sendAdminEmail(env, subject, text) {
  const apiKey = String(env?.RESEND_API_KEY || "").trim(), to = String(env?.ADMIN_NOTIFY_EMAIL || "").trim();
  if (!apiKey || !to) return { skipped: true, missing: [!to && "ADMIN_NOTIFY_EMAIL", !apiKey && "RESEND_API_KEY"].filter(Boolean) };
  const res = await fetch(String(env?.RESEND_API_URL || RESEND_URL), { method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: String(env?.RESEND_FROM_EMAIL || "onboarding@resend.dev").trim(), to: [to], subject, text }) });
  return res.ok ? { ok: true } : { ok: false, status: res.status, error: await readErrorMessage(res) };
}

const rp = n => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const methodLabel = m => (String(m || "").toLowerCase() === "cod" ? "COD" : String(m || "").trim() || "transfer");

// Pesan per kejadian. audience: "admin" | "customer"
export function buildMessage(event) {
  const o = event.order || {}, code = o.order_code || "", note = String(event.note || "").trim();
  switch (event.type) {
    case "order_created": return { audience: "admin", title: "Pesanan baru masuk", body: `${code} · ${o.customer_name || "Pelanggan"} · ${rp(o.total)} · ${methodLabel(o.payment_method)}`, url: "/admin/" };
    case "proof_uploaded": return { audience: "admin", title: "Bukti pembayaran perlu diverifikasi", body: `${code} · ${o.customer_name || "Pelanggan"} · ${rp(o.payment_amount || o.total)}`, url: "/admin/" };
    case "payment_verified": return { audience: "customer", title: "Pembayaran diterima", body: `Pembayaran pesanan ${code} sudah kami terima. Pesanan Anda sedang diproses.` };
    case "payment_rejected": return { audience: "customer", title: "Bukti pembayaran ditolak", body: `Bukti pembayaran pesanan ${code} perlu diperiksa kembali${note ? `: ${note}` : ""}. Silakan unggah ulang.` };
    case "status_processed": return { audience: "customer", title: "Pesanan diproses", body: `Pesanan ${code} sedang kami siapkan.` };
    case "status_delivering": return { audience: "customer", title: "Pesanan dikirim", body: `Pesanan ${code} sedang dalam pengiriman.${String(o.payment_method).toLowerCase() === "cod" ? " Siapkan pembayaran saat barang tiba." : ""}` };
    case "status_completed": return { audience: "customer", title: "Pesanan selesai", body: `Pesanan ${code} selesai. Terima kasih sudah berbelanja di Sayur Pasundan!` };
    case "cod_paid": return { audience: "customer", title: "Pembayaran COD diterima", body: `Pembayaran COD pesanan ${code} sudah kami terima. Terima kasih!` };
    case "order_cancelled": return { audience: "customer", title: "Pesanan dibatalkan", body: `Pesanan ${code} dibatalkan${note ? `: ${note}` : "."} Hubungi toko bila ada pertanyaan.` };
    case "order_expired": return { audience: "customer", title: "Pesanan dibatalkan", body: `Pesanan ${code} dibatalkan karena batas waktu pembayaran terlewati.` };
    default: return null;
  }
}

export async function notifyEvent(env, event) {
  const message = buildMessage(event);
  if (!message || !env?.DB) return { skipped: true };
  const db = env.DB, result = {};
  await ensureNotifyTables(db);
  if (message.audience === "admin") {
    const { results: subs = [] } = await db.prepare(`SELECT hash,endpoint FROM push_subscriptions WHERE role='admin'`).all();
    const vapid = await getVapid(db);
    const link = vapid.siteOrigin ? `\n${vapid.siteOrigin}/admin/` : "";
    const [push, telegram, email] = await Promise.all([
      pushTo(db, env, subs, message),
      sendTelegram(env, `${message.title}\n${message.body}${link}`).catch(e => ({ ok: false, error: String(e?.message || e) })),
      sendAdminEmail(env, `${message.title} - ${event.order?.order_code || ""}`, `${message.body}${link}`).catch(e => ({ ok: false, error: String(e?.message || e) }))
    ]);
    Object.assign(result, { push, telegram, email });
  } else {
    const code = event.order?.order_code;
    const { results: subs = [] } = await db.prepare(`SELECT hash,endpoint FROM push_subscriptions WHERE role='customer' AND order_code=?`).bind(code).all();
    result.push = await pushTo(db, env, subs, { ...message, url: `/pesanan?kode=${encodeURIComponent(code)}` });
  }
  return result;
}

// Panggil dari handler: tidak pernah melempar galat dan tidak menunda respons bila waitUntil tersedia.
export function emit(ctx, event) {
  const promise = notifyEvent(ctx?.env, event).catch(error => { console.error("[notify] gagal", error?.message || error); return { error: true }; });
  if (typeof ctx?.waitUntil === "function") ctx.waitUntil(promise);
  return promise;
}

export async function channelStatus(env) {
  const db = env?.DB;
  let adminDevices = 0;
  if (db) { await ensureNotifyTables(db); adminDevices = Number((await db.prepare(`SELECT COUNT(*) AS n FROM push_subscriptions WHERE role='admin'`).first())?.n || 0); }
  const has = name => Boolean(String(env?.[name] || "").trim());
  return {
    push: { adminDevices },
    telegram: { ready: has("TELEGRAM_BOT_TOKEN") && has("TELEGRAM_CHAT_ID"), missing: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"].filter(n => !has(n)) },
    email: { ready: has("RESEND_API_KEY") && has("ADMIN_NOTIFY_EMAIL"), missing: ["ADMIN_NOTIFY_EMAIL", "RESEND_API_KEY"].filter(n => !has(n)), sender: String(env?.RESEND_FROM_EMAIL || "onboarding@resend.dev") }
  };
}
