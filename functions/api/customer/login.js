import { json, readJson, requireDb, sameOrigin } from "../../_lib/http.js";
import { verifyPassword, createCustomerSession, customerSessionCookie } from "../../_lib/customer-auth.js";

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("8")) return "62" + digits;
  return digits;
}
function looksLikeEmail(value) { return String(value).includes("@"); }
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  if (!env?.SESSION_SECRET || String(env.SESSION_SECRET).length < 32 || String(env.SESSION_SECRET).startsWith("GANTI_DENGAN_STRING_ACAK")) {
    return json({ error: "SESSION_SECRET belum dikonfigurasi dengan aman." }, 503);
  }
  let db;
  try { db = requireDb(env); } catch { return json({ error: "Database belum tersambung." }, 503); }
  const body = await readJson(request);
  const identifier = String(body?.identifier || "").trim();
  const password = typeof body?.password === "string" ? body.password : "";
  if (!identifier || !password) return json({ error: "Nomor WhatsApp/email dan password wajib diisi." }, 400);
  const key = looksLikeEmail(identifier) ? identifier.toLowerCase() : normalizePhone(identifier);
  try {
    const customer = await db.prepare(`SELECT id, full_name, phone, email, password_hash, password_salt, password_iterations, status, email_verified_at
      FROM customer_accounts WHERE ${looksLikeEmail(identifier) ? "email" : "phone"} = ?`).bind(key).first();
    if (!customer || customer.status !== "active" ||
    !(await verifyPassword(password, customer.password_salt, customer.password_hash, customer.password_iterations))) {
  return json({ error: "Nomor/email atau password salah." }, 401);
}
    if (!customer.email_verified_at) {
      return json({
        error: "Email belum diverifikasi. Silakan verifikasi email terlebih dahulu.",
        needs_email_verification: true
      }, 403);
    }

    await db.prepare("UPDATE customer_accounts SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
      .bind(customer.id).run();
    const token = await createCustomerSession(customer.id, env);
    return json({ ok: true, customer: { id: customer.id, full_name: customer.full_name, phone: customer.phone, email: customer.email } }, 200, {
      "set-cookie": customerSessionCookie(token)
    });
  } catch (error) {
    console.error("[customer/login] Gagal memproses login", error);
    return json({ error: "Login belum dapat diproses. Silakan coba kembali." }, 500);
  }
}
