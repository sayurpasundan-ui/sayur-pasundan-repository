# Pengaturan Toko — Keputusan Awal

Pengaturan ini menjadi referensi tahap implementasi. Nilai yang bersifat rahasia atau masih belum final tidak boleh ditanam sebagai konstanta di frontend.

| Pengaturan | Nilai yang disepakati | Catatan |
|---|---|---|
| Nama toko | SAYUR PASUNDAN | CV Sahabat Raya Nusantara |
| Tagline | Rencanakan Masakan Anda | Header dan footer |
| Gudang/origin | Jl. Panggilingan, Kp. Pasir Angin, Desa Sukamantri, Kecamatan Paseh, Kabupaten Bandung, Jawa Barat 40383 | Lokasi kerja sesuai konfirmasi pemilik |
| Koordinat origin | -7.059522, 107.764035 | Dipakai perhitungan radius ongkir |
| WhatsApp | 0812-2103-1765 | Link publik: `https://wa.me/6281221031765` |
| Stok default | `unlimited` | Nilai 999 pada workbook Rev15 diperlakukan sebagai penanda unlimited |
| Foto produk | Satu foto utama per produk | Foto kategori hanya fallback tampilan, bukan foto produk asli |
| Gratis ongkir | Subtotal ≥ Rp50.000 | Perhitungan final harus di server |
| Ongkir di bawah minimum | Rp5.000 untuk radius ≤3 km; Rp10.000 untuk radius >3 km | Perlu menolak/mengecek alamat di luar area layanan; jarak server-side |
| COD | Bandung dan sekitarnya | Nilai maksimal Rp200.000; kecamatan final masih perlu didaftarkan |
| Variable konfigurasi batas COD | `COD_MAX_ORDER_TOTAL=200000` | Dipaparkan oleh `/api/settings`; validasi checkout server tetap pekerjaan Tahap 2 |
| Transfer manual | Kedaluwarsa 24 jam | Pembatalan + pengembalian reservasi stok masuk Tahap 2 |

## Info belum lengkap / jangan dipalsukan

- Data rekening yang diberikan pemilik untuk disiapkan pada Tahap 2: BCA 3760938407 (Devi Triani Maresa), SeaBank 901067184249 (Devi Triani Maresa), dan DANA 085808427577. Nama pemilik akun DANA belum disebutkan. Simpan di pengaturan database/admin saat fitur pembayaran dibuat; jangan hardcode ke frontend publik.
- Logo bank harus menggunakan file resmi asli, bukan logo yang digambar ulang.
- Email `sayurpasundan@gmail.com` adalah tujuan notifikasi yang diinginkan, tetapi pengiriman email butuh provider dan secret konfigurasi.
- Aktifkan COD setelah daftar kecamatan diterima admin dan lokasi dapat divalidasi di sisi server.
