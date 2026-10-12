// Penyimpanan gambar (foto produk, banner, logo pembayaran) tanpa Cloudflare R2.
// Jika binding R2 PRODUCT_IMAGES ada, R2 tetap dipakai. Jika tidak, gambar disimpan
// sebagai base64 di tabel D1 `image_files` (dibuat otomatis saat pertama dipakai).
import { bytesToBase64, base64ToBytes } from "./proof-storage.js";

// Batas D1 per baris = 2 MB; base64 menambah ~33% sehingga gambar dibatasi 1,2 MB.
export const IMAGE_D1_MAX_BYTES = 1_200_000;

export async function ensureImageTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS image_files (
    object_key TEXT PRIMARY KEY,
    mime_type TEXT NOT NULL,
    data_base64 TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`).run();
}

export async function saveImageToD1(db, key, mimeType, bytes) {
  await ensureImageTable(db);
  await db.prepare(`INSERT INTO image_files(object_key,mime_type,data_base64) VALUES(?,?,?)`).bind(key, mimeType, bytesToBase64(bytes)).run();
}

export async function readImageFromD1(db, key) {
  await ensureImageTable(db);
  const row = await db.prepare(`SELECT mime_type,data_base64 FROM image_files WHERE object_key=?`).bind(key).first();
  return row ? { mimeType: row.mime_type, bytes: base64ToBytes(row.data_base64) } : null;
}
