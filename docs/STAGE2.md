# Tahap 2 — Keranjang, Checkout Tamu, Pembayaran, dan Pelacakan

## Alur pelanggan yang dibuat

1. Keranjang disimpan di `localStorage` browser. Checkout tidak meminta akun pelanggan.
2. Checkout meminta nama, WhatsApp, alamat, kota/kabupaten, kecamatan, dan metode pembayaran. Untuk ongkir di bawah Rp50.000 serta COD, pelanggan harus menandai lokasi pengantaran dari izin lokasi browser.
3. Harga satuan dan status katalog dibaca ulang dari D1 oleh server. Harga dari browser tidak dipercaya.
4. Ongkir server: subtotal barang >= Rp50.000 gratis; jika subtotal < Rp50.000 dan jarak <=3 km, Rp5.000; jika jarak >3 km, Rp10.000. Jarak dihitung menggunakan Haversine dari koordinat gudang `-7.059522, 107.764035` dan koordinat yang dikirim dari browser. Jarak yang tampil sebagai estimasi perlu diverifikasi toko; ini belum memakai geocoding/pin peta pihak ketiga.
5. BCA, SeaBank, dan DANA disediakan sebagai pembayaran manual. Transfer/e-wallet mendapatkan kode unik tiga digit yang ditambahkan pada jumlah bayar; kode/nominal transfer yang masih aktif dijaga unik melalui `payment_refs`.
6. Batas waktu transfer 24 jam. Status awal `awaiting_payment`; setelah bukti yang valid diunggah menjadi `awaiting_verification`; sesudah admin memverifikasi status menjadi `paid` dan pesanan `processed`.
7. Bukti JPG/PNG/PDF diperiksa berdasarkan MIME dan signature berkas, maksimal 2 MB, disimpan di bucket R2 privat `PAYMENT_PROOFS` dan hanya dapat dibuka dari endpoint admin berautentikasi.
8. Pelacakan menggunakan kode pesanan dan nomor WhatsApp, bukan akun pembeli. Ringkasan dan instruksi pembayaran hanya ditampilkan jika keduanya cocok.
9. Admin dapat memverifikasi atau menolak bukti, mengubah status pesanan, dan menandai pembayaran COD telah diterima.
10. Worker terjadwal membatalkan transfer yang melewati tenggat setiap 15 menit. Pemeriksaan juga dilakukan saat pelanggan melacak/mengunggah bukti atau pesanan baru dibuat.

## Kebijakan dan keterbatasan penting

- Stok saat ini `unlimited`, jadi checkout tidak mengurangi stok fisik. Produk `stock_mode=tracked` sengaja ditolak checkout sampai stok dimodelkan per satuan jual; ini mencegah penjualan berlebihan ketika satu produk bisa dijual per PCS/KG/PACK dengan konversi berbeda. Karena tidak ada stok yang ditahan untuk model unlimited, pembatalan kadaluarsa tidak memerlukan pengembalian stok pada versi ini.
- COD maksimum Rp200.000 diterapkan pada total pesanan termasuk ongkir. COD diizinkan untuk Paseh, Majalaya, Solokan Jeruk, dan Ciparay di Kabupaten Bandung, Jawa Barat. Konfigurasi `COD_ALLOWED_DISTRICTS` disetel dengan daftar ini; API juga menolak COD jika kota/kabupaten bukan Kabupaten Bandung.
- COD mensyaratkan koordinat lokasi dan kecamatan yang cocok persis setelah normalisasi. Koordinat dikirim browser, sehingga pelanggan bisa mengubahnya; ini membantu estimasi tetapi belum sama dengan geocoding yang diverifikasi independen.
- Nilai rekening yang disediakan telah dimasukkan ke tabel `payment_methods` oleh migration: BCA `3760938407` atas nama Devi Triani Maresa; SeaBank `901067184249` atas nama Devi Triani Maresa; DANA `085808427577`. Nama pemilik akun DANA sudah dikonfirmasi: Devi Triani Maresa; migrasi 0003 memperbarui data tersebut.
- Logo resmi BCA, SeaBank, dan DANA belum disediakan sebagai file aset yang disetujui. UI menampilkan label metode bila `logo_url` kosong; tidak menggambar ulang logo secara keliru. Lengkapi `logo_url` dengan aset resmi yang boleh digunakan sebelum peluncuran.
- Unggah bukti memerlukan binding R2 privat `PAYMENT_PROOFS`. Jangan jadikan bucket ini publik dan jangan tambahkan route publik untuk objeknya.
- Belum ada notifikasi email/WhatsApp otomatis kepada pemilik. Tombol konfirmasi WhatsApp disediakan untuk pelanggan; integrasi notifikasi server masuk tahap berikutnya.
- Untuk peluncuran, pasang rate limit/anti-spam pada endpoint pesanan, tracking dan upload di Cloudflare. Validasi file di kode bukan pengganti rate limiting.

## Migrasi database

Buat backup D1 terlebih dahulu. Jalankan tiap file migrasi satu kali, berurutan, pada database yang benar:

```bash
npx wrangler d1 execute sayur-pasundan-db --remote --file=migrations/0001_initial.sql
npx wrangler d1 execute sayur-pasundan-db --remote --file=migrations/0002_checkout_payments.sql
npx wrangler d1 execute sayur-pasundan-db --remote --file=migrations/0003_confirmed_payment_and_cod_areas.sql
```

Tahap 3 menambahkan migrasi `0004_admin_stage3.sql`; lihat `docs/STAGE3.md` sebelum melanjutkan deployment.

Jangan menjalankan ulang migrasi yang sudah berhasil. Migrasi `0002` menambah kolom dengan `ALTER TABLE`, sedangkan `0003` memperbarui nama pemilik DANA yang telah dikonfirmasi.

## Binding dan konfigurasi Cloudflare Pages

Buat bucket produk dan bucket bukti transfer secara terpisah:

- D1 binding `DB` -> database `sayur-pasundan-db`.
- R2 binding `PRODUCT_IMAGES` -> bucket publik/akses gambar produk, sesuai konfigurasi gambar yang sudah ada.
- R2 binding `PAYMENT_PROOFS` -> bucket privat untuk bukti pembayaran.

Variables (telah disertakan sebagai nilai non-rahasia di `wrangler.jsonc`; samakan juga konfigurasi Pages produksi):

```text
PUBLIC_WA_PHONE=6281221031765
COD_MAX_ORDER_TOTAL=200000
COD_ALLOWED_DISTRICTS=Paseh,Majalaya,Solokan Jeruk,Ciparay
```

`COD_ALLOWED_DISTRICTS` adalah daftar kecamatan yang telah disetujui: Paseh, Majalaya, Solokan Jeruk, dan Ciparay. COD juga dibatasi ke `Kabupaten Bandung`, `Jawa Barat`; server menolak kota/kabupaten lain.

## Penjadwalan pembatalan otomatis

Cloudflare Pages Functions tidak menjalankan Cron Trigger secara otomatis dari folder `functions`. Untuk membatalkan pesanan tepat waktu, deploy worker terpisah:

1. Salin `wrangler-order-expiry.example.jsonc` menjadi `wrangler-order-expiry.jsonc`.
2. Ganti `GANTI_DENGAN_D1_DATABASE_ID` dengan ID database D1 yang sama dengan binding `DB` Pages.
3. Jalankan `npx wrangler deploy --config wrangler-order-expiry.jsonc`.
4. Pastikan Worker bernama `sayur-pasundan-order-expiry` menjalankan Cron `*/15 * * * *` dan terhubung ke database yang benar.

Untuk pesanan yang lewat tenggat, `status` menjadi `cancelled`, `payment_status` menjadi `expired`, dan referensi nominal transfer yang menunggu dilepas.

## Pemeriksaan lokal

```bash
npm install
npm run check:js
npm run check:stage1
npm run check:stage2
npm run check:stage3
python scripts/check-schema.py
npm run dev
```

Tes di atas memeriksa sintaks, aturan ongkir/nomor telepon, skema kedua migrasi, dan kelengkapan endpoint secara statis. Tes ini bukan simulasi penuh dengan layanan D1/R2 remote; lakukan tes pesanan menggunakan database dan bucket preview sebelum produksi.
