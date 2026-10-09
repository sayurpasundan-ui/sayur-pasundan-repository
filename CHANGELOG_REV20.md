# Changelog Rev20

## Pembaruan berdasarkan konfirmasi pemilik toko
- Nama pemilik akun DANA diatur menjadi Devi Triani Maresa melalui migrasi baru `0003_confirmed_payment_and_cod_areas.sql`.
- Area COD dikonfigurasi untuk Paseh, Majalaya, Solokan Jeruk, dan Ciparay, Kabupaten Bandung, Provinsi Jawa Barat.
- Checkout API memvalidasi kecamatan COD serta kota/kabupaten `Kabupaten Bandung` (dengan variasi penulisan `Kab. Bandung` dan `Kab Bandung`).
- `wrangler.jsonc` berisi variabel non-rahasia toko, termasuk batas COD Rp200.000, daftar kecamatan, kabupaten dan provinsi.
- Panduan deployment diperbarui untuk menjalankan tiga migrasi secara berurutan.

## Tetap perlu sebelum produksi
- Jalankan migrasi 0003 satu kali pada D1 yang sudah menjalankan 0001 dan 0002.
- Periksa binding D1/R2, secrets admin, Cron Worker expiry, logo pembayaran berizin, rate limit, dan uji checkout pada lingkungan preview.
- Nama pemilik DANA terkonfirmasi; aset logo resmi belum disediakan.
