import { json, sameOrigin } from "./http.js";

const COOKIE_NAME = "sp_customer_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const encoder = new TextEncoder();
const ITERATIONS = 210000;

function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function unb64url(value) {
  const base = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base + "=".repeat((4 - base.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}
function readCookie(request) {
  const cookies = request.headers.get("Cookie") || "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return null;
}
function validSecret(env) {
  const secret = String(env?.SESSION_SECRET || "");
  return secret.length >= 32 && !secret.startsWith("GANTI_DENGAN_STRING_ACAK");
}
async function signingKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function hashPassword(password, saltText = null, iterations = ITERATIONS) {
  const salt = saltText ? unb64url(saltText) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
  return { salt: b64url(salt), hash: b64url(bits), iterations };
}
export async function verifyPassword(password, salt, expectedHash, iterations) {
  const result = await hashPassword(password, salt, Number(iterations));
  const a = encoder.encode(result.hash);
  const b = encoder.encode(String(expectedHash || ""));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export async function createCustomerSession(customerId, env) {
  if (!validSecret(env)) throw new Error("SESSION_SECRET belum aman dikonfigurasi.");
  const payload = { sub: customerId, typ: "customer", exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS };
  const encoded = b64url(encoder.encode(JSON.stringify(payload)));
  const key = await signingKey(env.SESSION_SECRET);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(encoded)));
  return `${encoded}.${b64url(signature)}`;
}
export function customerSessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}
export function expiredCustomerSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
export async function requireCustomer(request, env) {
  if (!validSecret(env)) return { ok: false, response: json({ error: "Secret sesi belum dikonfigurasi dengan aman." }, 503) };
  const token = readCookie(request);
  if (!token || !token.includes(".")) return { ok: false, response: json({ error: "Sesi pelanggan diperlukan." }, 401) };
  const [encoded, signatureText] = token.split(".", 2);
  try {
    const key = await signingKey(env.SESSION_SECRET);
    const valid = await crypto.subtle.verify("HMAC", key, unb64url(signatureText), encoder.encode(encoded));
    if (!valid) return { ok: false, response: json({ error: "Sesi pelanggan tidak valid." }, 401) };
    const payload = JSON.parse(new TextDecoder().decode(unb64url(encoded)));
    if (payload.typ !== "customer" || typeof payload.sub !== "string" || !Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, response: json({ error: "Sesi pelanggan sudah kedaluwarsa." }, 401) };
    }
    const customer = await env.DB.prepare(
      "SELECT id, full_name, phone, email, status, email_verified_at FROM customer_accounts WHERE id = ?"
    ).bind(payload.sub).first();
    if (!customer || customer.status !== "active") return { ok: false, response: json({ error: "Akun pelanggan tidak aktif." }, 401) };
    if (!customer.email || !customer.email_verified_at) return { ok: false, response: json({ error: "Email pelanggan belum diverifikasi." }, 403) };
    return { ok: true, customer };
  } catch {
    return { ok: false, response: json({ error: "Sesi pelanggan tidak valid." }, 401) };
  }
}
export { COOKIE_NAME, ITERATIONS };

