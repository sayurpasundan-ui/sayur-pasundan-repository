# Ruang Lingkup — Sayur Pasundan

## Tujuan
Membangun fondasi web katalog/belanja Sayur Pasundan yang bisa dikelola melalui Admin Panel, memakai GitHub untuk kode dan Cloudflare Pages + Functions + D1 + R2 untuk web/backend/storage.

## Ketetapan yang digunakan
- Katalog bersumber dari database, bukan daftar produk hard-coded.
- Struktur data: `Kategori → Produk → Varian/Merk → Satuan & Harga`.
- Satu produk umum dapat memiliki banyak varian; satu varian dapat memiliki banyak satuan/harga.
- `status` katalog dibedakan dari `stock_status`.
- Satu foto utama per produk disimpan sebagai referensi di D1 (`product_id` unik); file foto tersedia sebagai aset statis atau R2. Foto kategori hanya fallback ilustrasi, bukan bukti foto asli produk.
- Checkout server menghitung ulang harga berdasarkan `id_satuan` di database.
- Admin Panel menjadi jalur utama perubahan katalog setelah impor awal.
- Excel untuk impor awal/perbaikan bulk, bukan alat operasional harian.

## Batas MVP
- Pembayaran masih dikonfirmasi manual oleh toko.
- Belum ada integrasi payment gateway.
- Ongkir radius gudang Bandung dan batas COD maksimal Rp200.000 sudah dicatat sebagai aturan bisnis, tetapi penghitungan ongkir di sisi server dan validasi alamat adalah pekerjaan Tahap 2; jangan menjanjikan hasil ongkir aktual sebelum fungsi itu dibuat.
- Stok dari workbook Rev15 saat ini ada di level Produk; aturan stok per satuan/konversi berat perlu keputusan bisnis tersendiri sebelum fitur pengurangan stok otomatis dibuat.
- Login admin awal menggunakan satu secret; sebelum produksi perlu dipertimbangkan rate limit, role, audit log, dan recovery.

## Data acuan
Workbook terbaru: `data/source/DATABASE SAYUR PASUNDAN REV 15 - ORIGINAL.xlsx`. Workbook sumber tidak diubah. Gunakan aturan pembersihan Rev17 untuk membuang ID/relasi ambigu, melewati path foto yang tidak tersedia, dan menyimpan produk yang belum siap dijual sebagai draft. Detail di `docs/DATA_AUDIT_REV15.md` dan `CHANGELOG_REV17.md`.

## Yang belum dapat diverifikasi
Redaksi lengkap “8 poin” awal belum ditemukan dari berkas yang tersedia. Cakupan teknis ini memetakan keputusan yang sudah tercatat, dan tidak mengklaim telah mencocokkan kata demi kata daftar 8 poin tersebut.
