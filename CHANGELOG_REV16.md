# Changelog Rev16 — Workbook Terbaru dan Aturan COD

Tanggal: 9 Oktober 2026

## Perubahan

- Menggunakan `DATABASE SAYUR PASUNDAN REV 15.xlsx` sebagai workbook acuan terbaru dan menyertakan file tersebut dalam folder lokal `data/import/` di paket ZIP. `.gitignore` tetap mengecualikan workbook dari commit Git.
- Mengganti laporan aktif menjadi `REV15_AUDIT.md` dan `docs/DATA_AUDIT_REV15.md` berdasarkan pembacaan langsung workbook terbaru.
- Memperbarui petunjuk audit/impor agar menunjuk ke workbook Rev15 terbaru.
- Menetapkan maksimum nilai COD **Rp200.000** sesuai konfirmasi terbaru pemilik. `functions/api/settings.js` mengembalikan `codMaxOrderTotal` dengan default 200000 (dapat ditimpa variable `COD_MAX_ORDER_TOTAL`).
- Memperbarui pesan katalog agar menyebut audit workbook Rev15.

## Temuan workbook terbaru

- 470 Produk, 6 Kategori, 632 Varian_Produk, 1.875 Satuan_Produk, 1.872 Foto_Produk, 2.109 Produk_Terkait.
- Satu varian tidak mempunyai ID (Royco Sapi) dan satu varian ID 2038 mengarah ke Produk ID 1048 yang tidak ada.
- Satuan ID 471, 472, 473 mengarah ke Varian ID 2154 yang tidak ada.
- Slug `pakcoy` terduplikasi pada Produk ID 1031 dan 1482.
- 566 path foto yang terisi tidak mempunyai file lokal; 1.306 baris foto tanpa image_url; 940 baris tanpa is_primary.
- Semua relasi produk terkait valid dan semua produk mempunyai deskripsi utama.

## Hasil pemeriksaan paket

Pemeriksaan sintaks JavaScript dan skema D1 dijalankan kembali saat membangun paket Rev16. Audit Excel berbasis skrip Node memerlukan `npm install`; pada lingkungan penyusunan ini dependensi `exceljs` belum tersedia. Data workbook diperiksa melalui API spreadsheet dan temuannya disimpan di laporan audit.

## Batasan

- Impor D1 tetap dilarang hingga error ID/relasi yang dicatat di laporan audit diperbaiki dan audit ulang lolos.
- Maksimum COD Rp200.000 telah dicatat dan dipaparkan pada settings API, tetapi transaksi COD yang fungsional dan validasi batasnya masih harus diimplementasikan pada Tahap 2.
- COD belum aman diaktifkan sampai daftar kecamatan yang dilayani di Kabupaten Bandung ditetapkan.
- Tidak ada deployment ke GitHub atau Cloudflare yang dilakukan dalam paket ini.
