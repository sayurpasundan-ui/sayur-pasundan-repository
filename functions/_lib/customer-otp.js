
const encoder = new TextEncoder();

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";

export function isLocalOtpTest(request, env) {
  if (env?.OTP_DEV_MODE !== "true") return false;

  try {
    const host = new URL(request.url).hostname;
    return ["localhost", "127.0.0.1", "::1"].includes(host);
  } catch {
    return false;
  }
}

export function generateEmailOtp() {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(bytes[0] % 1000000).padStart(6, "0");
}

export async function hashEmailOtp(customerId, otp, env) {
  const secret = String(env?.SESSION_SECRET || "");

  if (
    secret.length < 32 ||
    secret.startsWith("GANTI_DENGAN_STRING_ACAK")
  ) {
    throw new Error("SESSION_SECRET belum dikonfigurasi dengan aman.");
  }

  const input = `${secret}:${customerId}:${otp}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(input)
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sendOtpEmail(email, otp, env) {
  const apiKey = String(env?.RESEND_API_KEY || "").trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY belum dikonfigurasi.");
  }

  const from = String(
    env?.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL
  ).trim();

  console.log("[customer-otp] Memulai permintaan Resend.");
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Kode Verifikasi Email - Sayur Pasundan",
      text: [
        "Halo!",
        "",
        `Kode verifikasi email Anda: ${otp}`,
        "",
        "Kode berlaku selama 10 menit.",
        "Jangan bagikan kode ini kepada siapa pun.",
        "",
        "Jika Anda tidak merasa mendaftar, abaikan email ini.",
        "",
        "Sayur Pasundan"
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#24352a;line-height:1.6">
          <h2 style="color:#2f6b39">Verifikasi Email Sayur Pasundan</h2>
          <p>Gunakan kode berikut untuk memverifikasi alamat email Anda:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px;background:#f0f6ef;border-radius:10px;text-align:center">
            ${otp}
          </div>
          <p>Kode berlaku selama <strong>10 menit</strong>.</p>
          <p>Jangan bagikan kode ini kepada siapa pun.</p>
          <p style="color:#68746b;font-size:13px">Jika Anda tidak merasa mendaftar, abaikan email ini.</p>
          <p>Sayur Pasundan</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(
      "[customer-otp] Resend gagal mengirim email:",
      response.status,
      detail.slice(0, 500)
    );

    throw new Error("Email verifikasi gagal dikirim melalui Resend.");
  }
}

export async function issueEmailOtp(db, customerId, env) {
  const customer = await db.prepare(`
    SELECT email, email_verified_at, status
    FROM customer_accounts
    WHERE id = ?
  `).bind(customerId).first();

  if (!customer || customer.status !== "active") {
    return {
      ok: false,
      error: "Akun tidak ditemukan atau tidak aktif.",
      status: 404
    };
  }

  if (!customer.email) {
    return {
      ok: false,
      error: "Alamat email diperlukan untuk verifikasi.",
      status: 400
    };
  }

  if (customer.email_verified_at) {
    return { ok: true, alreadyVerified: true };
  }

  const now = Date.now();

  const existing = await db.prepare(`
    SELECT id, otp_hash, expires_at, attempts, last_sent_at, created_at
    FROM customer_email_otps
    WHERE customer_id = ?
  `).bind(customerId).first();

  if (existing?.last_sent_at) {
    const lastSent = Date.parse(existing.last_sent_at);

    if (Number.isFinite(lastSent) && now - lastSent < 60_000) {
      return {
        ok: false,
        error: "Tunggu 60 detik sebelum meminta kode baru.",
        status: 429
      };
    }
  }

  const otp = generateEmailOtp();
  const otpHash = await hashEmailOtp(customerId, otp, env);
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + 10 * 60_000).toISOString();
  const otpId = crypto.randomUUID();

  // Simpan sementara agar OTP lama dapat dipulihkan jika pengiriman gagal.
  await db.prepare(`
    INSERT INTO customer_email_otps
      (id, customer_id, otp_hash, expires_at, attempts, last_sent_at, created_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET
      id = excluded.id,
      otp_hash = excluded.otp_hash,
      expires_at = excluded.expires_at,
      attempts = 0,
      last_sent_at = excluded.last_sent_at,
      created_at = excluded.created_at
  `).bind(
    otpId,
    customerId,
    otpHash,
    expiresAt,
    createdAt,
    createdAt
  ).run();

  try {
    await sendOtpEmail(customer.email, otp, env);
  } catch (error) {
    // Pulihkan OTP sebelumnya jika pengiriman email gagal.
    try {
      if (existing) {
        await db.prepare(`
          UPDATE customer_email_otps
          SET id = ?, otp_hash = ?, expires_at = ?, attempts = ?,
              last_sent_at = ?, created_at = ?
          WHERE customer_id = ?
        `).bind(
          existing.id,
          existing.otp_hash,
          existing.expires_at,
          existing.attempts,
          existing.last_sent_at,
          existing.created_at,
          customerId
        ).run();
      } else {
        await db.prepare(`
          DELETE FROM customer_email_otps
          WHERE customer_id = ? AND id = ?
        `).bind(customerId, otpId).run();
      }
    } catch (restoreError) {
      console.error(
        "[customer-otp] Gagal memulihkan OTP sebelumnya:",
        restoreError
      );
    }

    console.error("[customer-otp] Pengiriman OTP gagal:", error.message);

    return {
      ok: false,
      error: "Email verifikasi belum dapat dikirim. Silakan coba kembali.",
      status: 503
    };
  }

  return { ok: true, otp };
}

export async function verifyEmailOtp(db, customerId, otp, env) {
  const record = await db.prepare(`
    SELECT otp_hash, expires_at, attempts
    FROM customer_email_otps
    WHERE customer_id = ?
  `).bind(customerId).first();

  if (!record) {
    return {
      ok: false,
      error: "Kode tidak valid atau sudah kedaluwarsa."
    };
  }

  if (Number(record.attempts) >= 5) {
    return {
      ok: false,
      error: "Batas percobaan tercapai. Minta kode baru."
    };
  }

  if (
    !Number.isFinite(Date.parse(record.expires_at)) ||
    Date.parse(record.expires_at) <= Date.now()
  ) {
    await db.prepare(
      "DELETE FROM customer_email_otps WHERE customer_id = ?"
    ).bind(customerId).run();

    return {
      ok: false,
      error: "Kode tidak valid atau sudah kedaluwarsa."
    };
  }

  const suppliedHash = await hashEmailOtp(customerId, otp, env);

  if (suppliedHash !== record.otp_hash) {
    await db.prepare(`
      UPDATE customer_email_otps
      SET attempts = attempts + 1
      WHERE customer_id = ?
    `).bind(customerId).run();

    return {
      ok: false,
      error: "Kode tidak valid atau sudah kedaluwarsa."
    };
  }

  await db.batch([
    db.prepare(`
      UPDATE customer_accounts
      SET email_verified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
        AND email IS NOT NULL
        AND status = 'active'
    `).bind(customerId),

    db.prepare(
      "DELETE FROM customer_email_otps WHERE customer_id = ?"
    ).bind(customerId)
  ]);

  return { ok: true };
}

