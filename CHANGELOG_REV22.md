# Changelog Rev22 — Persiapan Tahap 4 (belum final)

Tanggal: 2026-10-09

## Tujuan

Menindaklanjuti audit Rev21 untuk menguatkan fondasi lokal, mengurangi risiko salah target pada proses impor, menutup inkonsistensi fitur yang belum didukung, dan membuat jalur pengerjaan lokal → GitHub → Cloudflare preview lebih mudah diikuti.

## Perubahan

- Konfigurasi Wrangler diubah menjadi konfigurasi lokal untuk D1 dan dua binding R2 emulasi; tidak mematok `pages_build_output_dir` agar pengaturan Pages deployment kelak tidak tanpa sengaja mengambil alih konfigurasi lokal.
- Ditambahkan pemeriksaan minimum dan penolakan placeholder untuk `ADMIN_PASSWORD` serta `SESSION_SECRET`.
- Ditambahkan pemeriksaan signature format JPG/PNG/WebP/AVIF untuk upload foto produk.
- Helper Origin menolak Origin yang kosong, `null`, atau lintas origin untuk endpoint mutasi yang memanggil helper tersebut.
- Kode order baru menggunakan suffix acak 12 karakter; tracking tetap menerima suffix 6–12 karakter untuk kompatibilitas order lama.
- Tracking mengutamakan nomor WhatsApp dari pengaturan database toko.
- UI/API admin menolak mode stok fisik (`tracked`) karena checkout belum memvalidasi stok fisik per satuan.
- Ditambahkan header keamanan dasar untuk respons Pages.
- Health endpoint tidak mengembalikan rincian error internal database kepada publik.
- Skrip impor lokal ditujukan ke D1 lokal; skrip remote mewajibkan nama database dan konfirmasi nama target.
- Ditambahkan `scripts/check-stage4.mjs` dan langkah CI yang memeriksa validasi signature upload, Origin, sesi admin, konfigurasi lokal dan header.
- README/deployment docs diperbarui dan ditambahkan panduan Windows yang rinci, serta laporan kesiapan yang membedakan PASS lokal dari hal yang belum diverifikasi.

## Hasil pemeriksaan yang dijalankan

- Lolos syntax check untuk 57 file JavaScript.
- `check:stage1`, `check:stage2`, `check:stage3`, `check:stage4` lulus.
- Pemeriksaan skema Python lulus: empat file migrasi, 15 tabel dan foreign keys diperiksa.
- `npm run audit:excel` belum bisa dijalankan ulang di lingkungan audit ini karena paket ExcelJS belum tersedia. Pemasangan dependensi pada sesi audit mengalami timeout; audit workbook harus diulang secara lokal setelah `npm install` berhasil.
- Belum ada pengujian end-to-end Cloudflare D1/R2, deployment Pages, backup/restore, atau penerimaan pesanan nyata.

## Status

**Persiapan Tahap 4 masih berlangsung.** Rev22 bukan rilis production dan bukan klaim bahwa seluruh fitur sudah berjalan. Lihat `docs/STAGE4_READINESS_AUDIT.md` dan `docs/DEPLOYMENT_STEP_BY_STEP_ID.md`.
