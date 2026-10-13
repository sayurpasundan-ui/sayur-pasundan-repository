// Penyimpanan bukti pembayaran tanpa Cloudflare R2.
// Jika binding R2 PAYMENT_PROOFS tersedia, R2 tetap dipakai. Jika tidak, file disimpan
// sebagai base64 di tabel D1 `payment_proof_files` (dibuat otomatis saat pertama dipakai).

// Batas D1 per baris/string = 2 MB. Base64 menambah ~33%, jadi file dibatasi 1,2 MB.
export const D1_MAX_BYTES = 1_200_000;
export const R2_MAX_BYTES = 2 * 1024 * 1024;
export const D1_KEY_PREFIX = "d1:";

export function proofStorageMode(env) {
  return env?.PAYMENT_PROOFS ? "r2" : "d1";
}

export async function ensureProofTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS payment_proof_files (
    object_key TEXT PRIMARY KEY,
    data_base64 TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`).run();
}

export function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function base64ToBytes(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
