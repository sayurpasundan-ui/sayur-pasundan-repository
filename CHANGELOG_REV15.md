# Changelog Rev15 — Audit Database dan Persiapan Katalog

Tanggal: 9 Oktober 2026

> Riwayat revisi. Batas COD Rp50.000 di bawah adalah nilai saat Rev15 dibuat dan sudah digantikan oleh Rev16 menjadi Rp200.000. Sumber workbook aktif juga sudah berganti ke `DATABASE SAYUR PASUNDAN REV 15.xlsx`.

## Perubahan

- Beranda mobile-first memakai logo, tagline, background, 4 banner desktop rasio 2:1 dan 4 versi mobile rasio 4:3, ikon kategori, serta ikon benefit yang disediakan pemilik.
- Menyiapkan katalog dengan pencarian, kategori, filter harga, filter produk unggulan, pengurutan, dan pagination.
- Menyiapkan halaman detail produk dan produk terkait dengan pengambilan data dari API.
- Menambahkan halaman informasi dasar: Tentang Kami, Cara Belanja, Kebijakan Pengiriman, dan placeholder Lacak Pesanan yang menyatakan fitur pelacakan masih Tahap 2.
- Menormalkan rancangan foto menjadi satu foto utama per produk di D1, dengan `product_id` sebagai kunci produk dan `source_variant_id` opsional.
- Menambahkan `stock_mode=unlimited` agar nilai 999 di Excel tidak diperlakukan sebagai stok fisik.
- Mencatat pengaturan operasional yang telah dikonfirmasi: gudang Kabupaten Bandung, koordinat origin, aturan ongkir radius, WhatsApp, masa pembayaran 24 jam, batas nilai COD Rp50.000.
- Mengarahkan favicon Admin Panel ke ikon aplikasi yang disediakan.

## Hasil pemeriksaan

- Semua 30 file JavaScript lolos pemeriksaan sintaks.
- Migrasi SQL berhasil dieksekusi pada pemeriksaan lokal dan menghasilkan 8 tabel tanpa pelanggaran foreign key.
- Pemeriksaan referensi lokal HTML/CSS, dengan aturan rewrite Cloudflare Pages diperhitungkan, tidak menemukan referensi yang hilang.
- Arsip ZIP berhasil diuji dengan `unzip -t`.

## Belum selesai / batasan

- Workbook belum diimpor ke D1 dan belum ada deploy ke GitHub/Cloudflare.
- Impor ditahan sampai relasi orphan dan slug `pakcoy` ganda yang tercatat di `REV15_AUDIT.md` diperbaiki.
- Path foto produk lokal di workbook belum tersedia di repository; gambar kategori hanya fallback visual, bukan foto produk sebenarnya.
- Perhitungan ongkir di Tahap transaksi harus divalidasi server-side dan perlu batas area layanan.
- Daftar kecamatan yang diizinkan untuk COD Bandung belum ditetapkan.
- Checkout pembayaran transfer/COD, lacak pesanan yang fungsional, upload bukti bayar, pembatalan otomatis, invoice, notifikasi, dan pengelolaan konten homepage lewat Admin belum dianggap selesai.
- Instalasi dependensi untuk menjalankan audit workbook otomatis via ExcelJS timeout pada lingkungan kerja ini; hasil temuan workbook di `docs/DATA_AUDIT_REV15.md` berasal dari pemeriksaan data yang sudah dilakukan sebelumnya. Jalankan ulang `npm install` dan `npm run audit:excel` secara lokal sebelum impor.
