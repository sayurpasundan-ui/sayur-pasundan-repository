# Changelog Rev21 — Tahap 3 Admin

## Ditambahkan
- Dashboard Admin dengan metrik penjualan, pesanan terbaru, dan kesiapan konfigurasi toko.
- CRUD/arsip untuk produk, kategori, varian, satuan/harga, foto utama produk, banner, promosi tampilan, dan metode pembayaran.
- Pengaturan toko yang tersimpan di D1, termasuk ongkir, masa transfer, maksimum COD, kecamatan/kabupaten/provinsi COD, alamat gudang, koordinat, email, dan WhatsApp.
- Impor CSV produk utama dari Admin; impor multi-sheet tetap menggunakan skrip repository.
- Tautan Google Maps di ringkasan pesanan pelanggan dan Admin.
- Validasi tampilan COD berdasarkan kecamatan, kabupaten, provinsi, koordinat, dan maksimum total termasuk ongkir.
- Migrasi `0004_admin_stage3.sql`; pengujian otomatis `check:stage3` dan validasi CI diperluas.

## Diperbaiki
- Memperbaiki referensi setup checkout Google Maps agar fungsi `setupCheckoutMapFields()` benar-benar tersedia.
- Mencegah rekursi saat validasi metode pembayaran COD memperbarui ringkasan checkout.
- Mencegah Admin mencoba merender tabel resource saat tab Dashboard/Pengaturan aktif.
- Melindungi ringkasan detail pesanan dengan tautan Maps yang telah divalidasi host.

## Checkout dan konfirmasi
- Nama, nomor WhatsApp, alamat, kecamatan, kabupaten/kota, dan provinsi diwajibkan pada checkout.
- Kolom tautan Google Maps tersedia dan opsional; pembeli juga dapat menggunakan geolokasi perangkat untuk menentukan koordinat.
- Memperbaiki inisialisasi kode unik dan nominal transfer pada percobaan pembuatan pesanan, serta menjadikan nomor WhatsApp dari pengaturan D1 sebagai prioritas untuk tautan konfirmasi.
- Konfigurasi wilayah COD mencakup kabupaten dan provinsi di environment, sebagai fallback ketika pengaturan D1 belum terbaca.

## Belum termasuk
- Notifikasi otomatis email/WhatsApp kepada pemilik.
- Invoice PDF.
- Penerapan diskon otomatis pada total checkout (promo masih display-only).
- Deployment ke GitHub/Cloudflare dan tes transaksi pada layanan remote.
