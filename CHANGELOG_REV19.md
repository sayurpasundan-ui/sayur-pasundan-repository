# Changelog Rev19 — Tahap 2

- Menambahkan migration `0002_checkout_payments.sql`: detail pengiriman dan pembayaran pada pesanan, tabel metode pembayaran, bukti pembayaran privat, referensi nominal unik, dan riwayat status.
- Menambahkan checkout guest yang validasi harga dan ongkirnya dihitung ulang oleh API.
- Ongkir: subtotal >= Rp50.000 gratis; di bawahnya Rp5.000 sampai 3 km dan Rp10.000 di atas 3 km dari koordinat gudang.
- Menambahkan pilihan BCA, SeaBank, DANA dan COD dari tabel D1. Seed rekening berasal dari data yang diberikan pemilik; logo bank tidak diubah/direka ketika aset logo belum ada.
- Transfer/e-wallet: kode unik 3 digit, nominal transfer, batas pembayaran 24 jam, pemeriksaan due date dan pelepasan referensi pembayaran saat dibayar/dibatalkan/kedaluwarsa.
- Menambahkan halaman konfirmasi pesanan, pelacakan dengan kode + WhatsApp, instruksi pembayaran, hitung mundur, tombol salin rekening, dan unggah bukti JPG/PNG/PDF maksimal 2 MB.
- Bukti transfer masuk R2 privat dan hanya dapat dibuka oleh Admin yang login.
- Menambahkan tindakan Admin untuk verifikasi/tolak bukti, mengubah status, dan menandai pembayaran COD diterima.
- Menambahkan worker Cron terpisah untuk pembatalan transfer yang kedaluwarsa tiap 15 menit.
- Batas COD Rp200.000 diterapkan ke total termasuk ongkir. COD tetap nonaktif sampai daftar kecamatan disetel.
- Mode stok selain `unlimited` ditolak pada checkout sampai model stok per satuan dirancang; ini mencegah jumlah stok yang tidak bisa dikonversi secara aman.
- Foto produk yang kosong tetap kosong. Logo bank belum disediakan, sehingga tampilan menggunakan label metode teks sampai `logo_url` diisi.
- Menambahkan `npm run check:stage2` dan validasi seluruh migration.

## Belum dilakukan

- Belum ada deployment ke Cloudflare atau D1/R2 produksi.
- Belum dilakukan uji end-to-end ke database/bucket Cloudflare yang sesungguhnya.
- Belum ada daftar kecamatan COD, nama pemilik DANA, logo pembayaran yang disetujui, atau provider notifikasi WhatsApp/email.
- Belum ada model reservasi stok fisik karena kebijakan operasional saat ini adalah unlimited.
- Peningkatan ketahanan kedaluwarsa: pembatalan kini memakai conditional update dan hanya mencatat riwayat/melepas referensi jika status benar-benar berubah menjadi expired.
- Endpoint pelacakan dibatasi ke origin website; detail error internal tidak ditampilkan kepada pelanggan pada endpoint checkout, tracking, metode pembayaran, dan unggah bukti.
- README diperbarui agar status implementasi Tahap 2 dan prasyarat produksi tidak lagi tertulis sebagai fitur masa depan.
- Tes Tahap 2 kini memeriksa origin pada tracking, jadwal worker 15 menit, serta ketiadaan rute Admin dinamis yang bertabrakan.
