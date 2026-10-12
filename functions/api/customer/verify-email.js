
import { json, readJson, requireDb, sameOrigin } from "../../_lib/http.js";
import { verifyEmailOtp } from "../../_lib/customer-otp.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) {
    return json({ error: "Origin tidak diizinkan." }, 403);
  }

  let db;
  try {
    db = requireDb(env);
  } catch {
    return json({ error: "Database belum tersambung." }, 503);
  }

  const body = await readJson(request);
  const email = String(body?.email || "").trim().toLowerCase();
  const otp = String(body?.otp || "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(otp)) {
    return json({ error: "Email atau kode OTP tidak valid." }, 400);
  }

  try {
    const customer = await db.prepare(`
      SELECT id, email_verified_at, status
      FROM customer_accounts
      WHERE email = ?
    `).bind(email).first();

    if (!customer || customer.status !== "active") {
      return json({
        error: "Kode tidak valid atau sudah kedaluwarsa."
      }, 400);
    }

    if (customer.email_verified_at) {
      return json({
        ok: true,
        message: "Email sudah terverifikasi. Silakan login."
      });
    }

    const result = await verifyEmailOtp(db, customer.id, otp, env);

    if (!result.ok) {
      return json({
        error: result.error || "Kode tidak valid atau sudah kedaluwarsa."
      }, 400);
    }

    return json({
      ok: true,
      message: "Email berhasil diverifikasi. Silakan login."
    });
  } catch (error) {
    console.error("[customer/verify-email] Gagal memverifikasi email", error);
    return json({
      error: "Verifikasi belum dapat diproses. Silakan coba kembali."
    }, 500);
  }
}
