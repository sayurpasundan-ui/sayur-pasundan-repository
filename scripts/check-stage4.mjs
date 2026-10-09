import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { validImageMagic } from "../functions/_lib/image-validation.js";
import { sameOrigin } from "../functions/_lib/http.js";
import { createSession, requireAdmin } from "../functions/_lib/auth.js";

const root = process.cwd();
const read = file => fs.readFile(path.join(root, file), "utf8");

// Image signature checks: a MIME label alone must not permit an unrelated file.
assert.equal(validImageMagic("image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff, 0xdb])), true);
assert.equal(validImageMagic("image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
assert.equal(validImageMagic("image/webp", Uint8Array.from([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50])), true);
assert.equal(validImageMagic("image/avif", Uint8Array.from([0,0,0,0,0x66,0x74,0x79,0x70,0x61,0x76,0x69,0x66])), true);
assert.equal(validImageMagic("image/png", Uint8Array.from([0xff, 0xd8, 0xff, 0xdb])), false);
assert.equal(validImageMagic("image/jpeg", Uint8Array.from([0xff, 0xd8])), false);
assert.equal(validImageMagic("application/pdf", Uint8Array.from([0x25,0x50,0x44,0x46,0x2d])), false);

// Mutation endpoints require an explicit same-origin Origin header.
assert.equal(sameOrigin(new Request("https://shop.example/api/orders", { method: "POST" })), false);
assert.equal(sameOrigin(new Request("https://shop.example/api/orders", { method: "POST", headers: { Origin: "https://shop.example" } })), true);
assert.equal(sameOrigin(new Request("https://shop.example/api/orders", { method: "POST", headers: { Origin: "https://attacker.example" } })), false);
assert.equal(sameOrigin(new Request("https://shop.example/api/orders", { method: "POST", headers: { Origin: "null" } })), false);

// Session verification uses the actual HMAC implementation (Node 22 Web Crypto).
const env = { SESSION_SECRET: "a-strong-random-test-secret-which-is-more-than-32-chars" };
const token = await createSession(env);
const validRequest = new Request("https://shop.example/admin/", { headers: { Cookie: `sp_admin_session=${token}` } });
assert.equal((await requireAdmin(validRequest, env)).ok, true);
const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
const invalidRequest = new Request("https://shop.example/admin/", { headers: { Cookie: `sp_admin_session=${tampered}` } });
assert.equal((await requireAdmin(invalidRequest, env)).ok, false);
assert.equal((await requireAdmin(validRequest, { SESSION_SECRET: "short" })).ok, false);

const upload = await read("functions/api/admin/upload.js");
assert.match(upload, /MAX_BYTES = 6 \* 1024 \* 1024/);
assert.match(upload, /validImageMagic\(file\.type, bytes\)/);
assert.match(upload, /requireAdmin/);
assert.match(upload, /sameOrigin/);
const proofUpload = await read("functions/api/orders/[code]/proof.js");
assert.match(proofUpload, /MAX_BYTES = 2 \* 1024 \* 1024/);
assert.match(proofUpload, /PAYMENT_PROOFS/);
assert.match(proofUpload, /validMagic\(file\.type, bytes\)/);
const proofRoute = await read("functions/api/admin/payment-proofs/[id].js");
assert.match(proofRoute, /requireAdmin/);
assert.match(proofRoute, /cache-control.*private, no-store/i);

const login = await read("functions/api/admin/login.js");
assert.match(login, /SESSION_SECRET\)\.length < 32/);
assert.match(login, /ADMIN_PASSWORD\)\.length < 12/);
assert.match(login, /GANTI_DENGAN_PASSWORD/);
assert.match(login, /GANTI_DENGAN_STRING_ACAK/);
const createOrder = await read("functions/api/orders.js");
assert.match(createOrder, /replaceAll\("-", ""\)\.slice\(0, 12\)/);
const track = await read("functions/api/orders/track.js");
assert.match(track, /\[A-Z0-9\]\{6,12\}/);
assert.match(track, /readStoreSettings/);
assert.match(track, /settings\.whatsappPhone \|\| env\.PUBLIC_WA_PHONE/);

const adminStockUi = await read("public/admin/admin.js");
assert.match(adminStockUi, /Unlimited \(mode yang didukung saat ini\)/);
assert.doesNotMatch(adminStockUi, /value:"tracked",label:"Stok fisik"/);
for (const file of ["functions/api/admin/products.js", "functions/api/admin/products/[id].js", "functions/api/admin/products/import.js"]) {
  assert.match(await read(file), /stock_mode|stockMode/);
  assert.match(await read(file), /Mode stok fisik belum didukung|mode stok fisik belum didukung/);
}

const configText = await read("wrangler.jsonc");
const config = JSON.parse(configText);
assert.equal(config.name, "sayur-pasundan-local");
assert.equal(config.d1_databases?.[0]?.binding, "DB");
assert.equal(config.d1_databases?.[0]?.database_name, "sayur-pasundan-local");
assert.equal(config.d1_databases?.[0]?.migrations_dir, "migrations");
assert.deepEqual(config.r2_buckets.map(x => x.binding).sort(), ["PAYMENT_PROOFS", "PRODUCT_IMAGES"]);
assert.equal(Object.hasOwn(config, "pages_build_output_dir"), false, "Local config must not take over Cloudflare Pages project production settings.");

const headers = await read("public/_headers");
for (const expected of ["X-Content-Type-Options: nosniff", "X-Frame-Options: DENY", "/admin/*", "/api/*", "Cache-Control: no-store"]) assert.ok(headers.includes(expected), `Missing header policy: ${expected}`);
const ignore = await read(".gitignore");
assert.match(ignore, /^\.dev\.vars$/m);
assert.match(ignore, /^\*\.xlsx$/m);
assert.match(ignore, /^node_modules\/$/m);
const readme = await read("README.md");
assert.match(readme, /DEPLOYMENT_STEP_BY_STEP_ID\.md/);
assert.match(readme, /STAGE4_READINESS_AUDIT\.md/);
assert.ok(await fs.stat(path.join(root, "docs/DEPLOYMENT_STEP_BY_STEP_ID.md")));
assert.ok(await fs.stat(path.join(root, "docs/STAGE4_READINESS_AUDIT.md")));

console.log("PASS: validasi signature upload produk, Origin anti-CSRF, sesi admin HMAC, batas secret, bukti pembayaran privat, kode pesanan baru/kompatibilitas lama, mode stok, konfigurasi lokal, header keamanan dan panduan Tahap 4.");
console.log("Catatan: ini pemeriksaan lokal berbasis kode/komponen; bukan pengujian end-to-end Cloudflare D1/R2.");
