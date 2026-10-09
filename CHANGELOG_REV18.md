# Changelog Rev18 — Tahap 1

Tanggal: 9 Oktober 2026

- Menguatkan homepage/katalog/halaman detail untuk Tahap 1.
- Foto produk kosong atau tidak didukung ditampilkan kosong; ilustrasi kategori tidak menjadi pengganti foto produk.
- Menambah zoom gambar pada halaman detail saat foto benar-benar tersedia.
- Menambah filter katalog yang dapat dibagikan/pulih melalui URL (`q`, `kategori`, `min`, `max`, `unggulan`, `urut`).
- Menambah static smoke test `scripts/check-stage1.mjs` dan hook CI.
- Membatalkan cache PWA lama melalui cache id baru.
- Tidak mengubah workbook sumber; belum ada impor D1 atau deployment produksi.
