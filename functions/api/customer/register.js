import { json, readJson, requireDb, safeText, sameOrigin } from "../../_lib/http.js";
import { hashPassword } from "../../_lib/customer-auth.js";
import { issueEmailOtp, isLocalOtpTest } from "../../_lib/customer-otp.js";

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("8")) return "62" + digits;
  return digits;
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) {
    return json({ error: "Origin tidak diizinkan." }, 403);
  }

  if (!env?.SESSION_SECRET || String(env.SESSION_SECRET).length < 32 ||
      String(env.SESSION_SECRET).startsWith("GANTI_DENGAN_STRING_ACAK")) {
    return json({ error: "SESSION_SECRET belum dikonfigurasi dengan aman." }, 503);
  }

  let db;
  try {
    db = requireDb(env);
  } catch {
    return json({ error: "Database belum tersambung." }, 503);
  }

  const body = await readJson(request);
  const fullName = safeText(body?.full_name, 120);
  const phoneRaw = safeText(body?.phone, 40);
  const emailRaw = safeText(body?.email, 254);
  const password = typeof body?.password === "string" ? body.password : "";
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const email = emailRaw ? emailRaw.toLowerCase().trim() : null;

  if (!fullName || fullName.length < 2) {
    return json({ error: "Nama minimal 2 karakter." }, 400);
  }
  if (!email) {
    return json({ error: "Email wajib diisi untuk verifikasi akun." }, 400);
  }
  if (!validEmail(email)) {
    return json({ error: "Format email tidak valid." }, 400);
  }
  if (phone && !/^\d{10,15}$/.test(phone)) {
    return json({ error: "Nomor WhatsApp tidak valid." }, 400);
  }
  if (password.length < 8 || password.length > 128) {
    return json({ error: "Password harus 8-128 karakter." }, 400);
  }
  if (!/[A-Z]/.test(password)) {
    return json({ error: "Password wajib mengandung minimal 1 huruf besar." }, 400);
  }
  if (!/[a-z]/.test(password)) {
    return json({ error: "Password wajib mengandung minimal 1 huruf kecil." }, 400);
  }
  if (!/[0-9]/.test(password)) {
    return json({ error: "Password wajib mengandung minimal 1 angka." }, 400);
  }

  try {
    const hashed = await hashPassword(password);
    const id = crypto.randomUUID();

    await db.prepare(`
      INSERT INTO customer_accounts
        (id, full_name, phone, email, password_hash, password_salt, password_iterations)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, fullName, phone, email,
      hashed.hash, hashed.salt, hashed.iterations
    ).run();

    const issued = await issueEmailOtp(db, id, env);
    if (!issued.ok) {
      return json({ error: issued.error }, issued.status);
    }

    const response = {
      ok: true,
      needs_email_verification: true,
      message: "Akun dibuat. Verifikasi email sebelum login."
    };

    if (isLocalOtpTest(request, env)) {
      response.development_otp = issued.otp;
    }

    return json(response, 201);
  } catch (error) {
    if (/unique|constraint/i.test(String(error?.message || error))) {
      return json({ error: "Nomor WhatsApp atau email tersebut sudah terdaftar." }, 409);
    }

    console.error("[customer/register] Gagal membuat akun", error);
    return json({ error: "Akun belum berhasil dibuat. Silakan coba kembali." }, 500);
  }
}
