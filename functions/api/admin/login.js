import { json, readJson, sameOrigin } from "../../_lib/http.js";
import { createSession, safeEqual, sessionCookie } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: "Secret ADMIN_PASSWORD dan SESSION_SECRET belum diset." }, 503);
  if (String(env.SESSION_SECRET).length < 32 || String(env.SESSION_SECRET).startsWith("GANTI_DENGAN_STRING_ACAK")) return json({ error: "Ganti SESSION_SECRET contoh dengan secret acak minimal 32 karakter." }, 503);
  if (String(env.ADMIN_PASSWORD).length < 12 || String(env.ADMIN_PASSWORD).startsWith("GANTI_DENGAN_PASSWORD")) return json({ error: "Ganti ADMIN_PASSWORD contoh dengan kata sandi minimal 12 karakter." }, 503);
  const body = await readJson(request);
  if (!body || typeof body.password !== "string") return json({ error: "Password wajib diisi." }, 400);
  if (!safeEqual(body.password, env.ADMIN_PASSWORD)) return json({ error: "Password salah." }, 401);
  const token = await createSession(env);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
}
