import { json, readJson, requireDb, sameOrigin } from "../../_lib/http.js";
import { issueEmailOtp, isLocalOtpTest } from "../../_lib/customer-otp.js";

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

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Format email tidak valid." }, 400);
  }

  try {
    const customer = await db.prepare(`
      SELECT id, email_verified_at, status
      FROM customer_accounts
      WHERE email = ?
    `).bind(email).first();

    if (!customer || customer.status !== "active" || customer.email_verified_at) {
      return json({
        ok: true,
        message: "Jika akun membutuhkan verifikasi, instruksi akan tersedia melalui email."
      });
    }

    const issued = await issueEmailOtp(db, customer.id, env);

    if (!issued.ok) {
      return json({ error: issued.error }, issued.status);
    }

    if (isLocalOtpTest(request, env)) {
      return json({
        ok: true,
        message: "OTP lokal dibuat.",
        development_otp: issued.otp
      });
    }

    return json({
      ok: true,
      message: "Jika akun membutuhkan verifikasi, instruksi akan tersedia melalui email."
    });
  } catch (error) {
    console.error("[customer/resend-otp] Gagal memproses OTP", error);
    return json({ error: "Permintaan belum dapat diproses. Silakan coba kembali." }, 500);
  }
}
