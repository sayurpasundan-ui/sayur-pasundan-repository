# Tahap 3 — Dashboard Admin dan Pengelolaan Toko

Tahap ini memperluas fondasi Rev20/Stage 2. Pelanggan tetap berbelanja sebagai tamu; tidak ada pendaftaran akun pelanggan. Akses Admin dilindungi session cookie dan membutuhkan secrets `ADMIN_PASSWORD` serta `SESSION_SECRET`.

## Fitur

- Dashboard ringkasan: pesanan hari ini, pesanan menunggu verifikasi, penjualan yang telah dibayar pada hari/bulan berjalan, pesanan terbaru, dan daftar kesiapan konfigurasi.
- Pengelolaan produk, kategori, varian, satuan/harga, dan satu foto utama per produk; produk dapat diarsipkan, bukan dihapus permanen, agar riwayat pesanan tetap aman.
- Impor CSV untuk data produk utama melalui Admin. Impor workbook multi-sheet lengkap tetap menggunakan skrip `npm run audit:excel` dan `npm run import:excel`; tinjau laporan sebelum impor.
- Kelola banner desktop/mobile, promosi tampilan, metode pembayaran/logo, nomor rekening/pemilik, serta pengaturan toko, ongkir, dan area COD.
- Detail pesanan memuat alamat lengkap, provinsi, tautan Google Maps jika tersedia, daftar barang, dan bukti transfer privat. Admin dapat mengubah status, memverifikasi atau menolak bukti, dan menandai COD telah diterima saat pesanan sudah dalam status dikirim.
- Checkout mewajibkan nama, nomor WhatsApp, alamat, kecamatan, kabupaten/kota, dan provinsi. Tautan Google Maps bersifat opsional untuk dicantumkan, namun koordinat dibutuhkan untuk menghitung ongkir di bawah Rp50.000 serta untuk COD. Pelanggan dapat menempel tautan Maps yang berisi koordinat atau menggunakan geolokasi perangkat; Google Maps API key tidak wajib.

## Migrasi

Buat backup D1 terlebih dahulu. Untuk instalasi baru, jalankan seluruh migrasi satu kali dengan urutan berikut:

```bash
npx wrangler d1 execute sayur-pasundan-db --remote --file=migrations/0001_initial.sql
npx wrangler d1 execute sayur-pasundan-db --remote --file=migrations/0002_checkout_payments.sql
npx wrangler d1 execute sayur-pasundan-db --remote --file=migrations/0003_confirmed_payment_and_cod_areas.sql
npx wrangler d1 execute sayur-pasundan-db --remote --file=migrations/0004_admin_stage3.sql
```

Jika migrasi 0001–0003 sudah berhasil diterapkan di database tersebut, jalankan hanya 0004. Jangan menjalankan ulang file yang memiliki `ALTER TABLE`.

## Binding / secret Cloudflare

- D1 binding `DB` ke database toko.
- R2 binding `PRODUCT_IMAGES` untuk gambar produk/banner/logo.
- R2 binding `PAYMENT_PROOFS` untuk bukti pembayaran dan tetap privat.
- Secrets: `ADMIN_PASSWORD` dan `SESSION_SECRET` (gunakan nilai acak panjang untuk secret sesi).
- Pastikan variables/setting awal berisi `COD_ALLOWED_DISTRICTS=Paseh,Majalaya,Solokan Jeruk,Ciparay`, `COD_ALLOWED_CITY=Kabupaten Bandung`, `COD_ALLOWED_PROVINCE=Jawa Barat`, dan `COD_MAX_ORDER_TOTAL=200000`. Baris di D1 `store_settings` yang sudah ada menjadi sumber utama setelah migrasi.

## Batasan yang masih ada

- Tidak ada integrasi pembayaran otomatis; transfer dan e-wallet diverifikasi manual oleh Admin.
- Upload logo payment method tersedia, tetapi gunakan logo resmi dengan izin yang diperlukan. Jika belum diunggah, UI akan menampilkan nama metode alih-alih placeholder logo.
- Promo persentase/potongan nominal saat ini adalah konten promosi yang dikelola Admin, belum otomatis mengubah total checkout. Ini diberitahukan pada Admin agar diskon tidak dianggap berjalan sebelum tahap implementasi terpisah.
- Notifikasi email/WhatsApp otomatis ke pemilik dan invoice PDF berada di tahap berikutnya.
- Daftar area COD yang dipakai adalah Paseh, Majalaya, Solokan Jeruk, Ciparay, Kabupaten Bandung, Jawa Barat. Server memvalidasi area, provinsi, koordinat, dan batas COD Rp200.000 termasuk ongkir.
- Hasil check script adalah pemeriksaan statis dan schema lokal; bukan pengujian end-to-end pada D1/R2 remote. Uji di preview sebelum membuka order publik.

## Pengujian lokal

```bash
npm install
npm run check:js
npm run check:stage1
npm run check:stage2
npm run check:stage3
python scripts/check-schema.py
npm run dev
```
