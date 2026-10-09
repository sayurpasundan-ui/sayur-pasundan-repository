export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

export function errorJson(message, status = 400) {
  return json({ error: message }, status);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function requireDb(env) {
  if (!env?.DB) throw new Error("Binding D1 bernama DB belum dipasang.");
  return env.DB;
}

export function normalizeStatus(value, fallback = "active") {
  const v = String(value ?? fallback).trim().toLowerCase().replace(/[ -]+/g, "_");
  const allowed = new Set(["draft", "active", "archived", "in_stock", "low_stock", "out_of_stock", "pre_order", "pending", "processed", "delivering", "completed", "cancelled"]);
  return allowed.has(v) ? v : fallback;
}

export function numberOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toIntBool(value) {
  return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
}

export function safeText(value, max = 5000) {
  if (value == null) return null;
  return String(value).trim().slice(0, max);
}

export function sameOrigin(request) {
  // All browser mutations in this application are fetch/FormData POSTs and must
  // carry an Origin header. Reject absent Origin instead of treating it as trusted.
  const origin = request.headers.get("Origin");
  if (!origin || origin === "null") return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}
