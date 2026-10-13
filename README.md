# Sayur Pasundan — Rev22 / Tahap 4 (belum final)

Fondasi toko online satu penjual dengan **GitHub + Cloudflare Pages/Pages Functions + D1 + R2**. Pembeli checkout sebagai tamu; pemilik toko menggunakan Admin Panel. Paket ini disiapkan untuk audit lokal dan belum berarti aplikasi siap menerima pesanan pelanggan.

## Status singkat

Ringkasan perubahan: [`CHANGELOG_REV22.md`](CHANGELOG_REV22.md).

- **Rev21 yang diaudit:** homepage/katalog/detail produk, keranjang/checkout, pembayaran transfer manual/COD, pelacakan dan bukti pembayaran, serta Admin Panel.
- **Perubahan persiapan Tahap 4:** konfigurasi lokal D1/R2, pemeriksaan secret Admin, validasi signature foto, aturan Origin, header keamanan dasar, mode stok yang konsisten dengan checkout, dan skrip impor remote yang meminta target eksplisit.
- **Belum diverifikasi:** deployment Cloudflare, integrasi nyata dengan D1/R2 cloud, pengujian end-to-end dan proses backup/restore.
- **Ditunda:** email otomatis dan SEO/performa lanjutan. Promo diskon checkout dan invoice PDF otomatis juga tidak boleh dianggap aktif sebelum implementasi dan pengujian khusus.

## Mulai dari sini

Jika Anda baru pertama kali mengunggah repository, baca [`MULAI_DI_SINI.md`](MULAI_DI_SINI.md) terlebih dahulu. **Node.js tidak diperlukan hanya untuk menerbitkan kode ke GitHub**; Node.js diperlukan untuk pemeriksaan dan server lokal.

## Mulai dari lokal

1. Instal Node.js 22 LTS atau lebih baru.
2. Salin `.dev.vars.example` menjadi `.dev.vars`, kemudian ganti placeholder dengan secret lokal yang kuat. Jangan commit file itu.
3. Jalankan `npm install`.
4. Terapkan `migrations/0001_initial.sql` sampai `0004_admin_stage3.sql` ke D1 lokal menggunakan perintah `--local` di [`docs/DEPLOYMENT_STEP_BY_STEP_ID.md`](docs/DEPLOYMENT_STEP_BY_STEP_ID.md).
5. Audit workbook Rev15 dan tinjau laporan sebelum impor.
6. Jalankan pemeriksaan kode dan jalankan `npm run dev`.

**Panduan Windows lengkap (lokal → GitHub → Cloudflare preview):** [`docs/DEPLOYMENT_STEP_BY_STEP_ID.md`](docs/DEPLOYMENT_STEP_BY_STEP_ID.md).

**Audit kesiapan, batasan dan gerbang pengujian:** [`docs/STAGE4_READINESS_AUDIT.md`](docs/STAGE4_READINESS_AUDIT.md).

## Struktur penting

- `public/` — halaman publik, aset, dan Admin Panel.
- `functions/` — API Cloudflare Pages Functions.
- `migrations/` — skema database D1, dijalankan berurutan.
- `scripts/` — pemeriksaan, audit Excel dan generator SQL impor.
- `data/source/` — workbook sumber lokal; jangan commit ke Git.
- `generated/import/` — laporan dan SQL hasil impor lokal; file hasil generasi diabaikan Git.
- `wrangler.jsonc` — konfigurasi lokal, bukan sumber konfigurasi production Pages.

## Pemeriksaan otomatis

```powershell
npm run check:js
npm run check:stage1
npm run check:stage2
npm run check:stage3
npm run check:stage4
python scripts/check-schema.py
```

Pemeriksaan ini tidak menggantikan tes transaksi end-to-end dengan binding D1/R2 preview. Jangan menambahkan custom domain, melakukan impor ke D1 produksi, atau menerima pesanan pelanggan sebelum gerbang kesiapan dalam audit diselesaikan.
Deployment refresh
