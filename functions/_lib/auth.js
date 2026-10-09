import { json } from "./http.js";

const COOKIE_NAME = "sp_admin_session";
const SESSION_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromBase64Url(value) {
  const base = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base + "=".repeat((4 - base.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}
function cookieValue(request) {
  const cookies = request.headers.get("Cookie") || "";
  for (const pair of cookies.split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return null;
}
async function signingKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSession(env) {
  const payload = { sub: "admin", exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS };
  const encoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await signingKey(env.SESSION_SECRET);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(encoded)));
  return `${encoded}.${toBase64Url(signature)}`;
}

export async function requireAdmin(request, env) {
  if (!env?.SESSION_SECRET) return { ok: false, response: json({ error: "Secret SESSION_SECRET belum diset." }, 503) };
  if (String(env.SESSION_SECRET).length < 32 || String(env.SESSION_SECRET).startsWith("GANTI_DENGAN_STRING_ACAK")) return { ok: false, response: json({ error: "Ganti SESSION_SECRET contoh dengan secret acak minimal 32 karakter." }, 503) };
  const token = cookieValue(request);
  if (!token || !token.includes(".")) return { ok: false, response: json({ error: "Sesi admin diperlukan." }, 401) };
  const [encoded, signatureText] = token.split(".", 2);
  try {
    const key = await signingKey(env.SESSION_SECRET);
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signatureText), encoder.encode(encoded));
    if (!valid) return { ok: false, response: json({ error: "Sesi admin tidak valid." }, 401) };
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
    if (payload.sub !== "admin" || !Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, response: json({ error: "Sesi admin sudah kedaluwarsa." }, 401) };
    }
    return { ok: true };
  } catch {
    return { ok: false, response: json({ error: "Sesi admin tidak valid." }, 401) };
  }
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}
export function expiredSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
export function safeEqual(a, b) {
  const aa = encoder.encode(String(a ?? ""));
  const bb = encoder.encode(String(b ?? ""));
  let diff = aa.length ^ bb.length;
  const length = Math.max(aa.length, bb.length);
  for (let i = 0; i < length; i++) diff |= (aa[i % Math.max(aa.length, 1)] || 0) ^ (bb[i % Math.max(bb.length, 1)] || 0);
  return diff === 0;
}
