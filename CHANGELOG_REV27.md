# Rev 27 — pembatalan, retur, dan laporan penerimaan

- Pelanggan tidak punya jalur pembatalan; pembatalan hanya lewat admin.
- Admin dapat membatalkan pesanan tahap menunggu bayar/diproses (termasuk COD) tanpa alasan khusus.
- Pesanan tahap dikirim/selesai hanya bisa dibatalkan/diretur dengan alasan wajib, salah satu dari: customer tidak ada di rumah, customer tidak dapat dihubungi, alamat tidak ditemukan, barang rusak, barang tidak sesuai, barang kosong.
- Pesanan yang sudah dibayar (transfer terverifikasi / COD diterima) bisa dibatalkan/diretur; nilainya dicatat di `refund_amount` dan mengurangi laporan penerimaan. Pengembalian dana ke pelanggan tetap manual.
- Pesanan yang sudah dibatalkan tidak dapat diaktifkan kembali.
- Dashboard: penerimaan bersih = uang masuk per tanggal bayar dikurangi retur per tanggal retur; kartu baru "Retur/batal bulan ini".
- Pembatalan otomatis: penyapu kedaluwarsa kini juga berjalan saat admin membuka dashboard, daftar pesanan, dan memperbarui pesanan. Worker Cron (`wrangler-order-expiry.example.jsonc`) tetap wajib di-deploy terpisah karena Cloudflare Pages tidak menjalankan Cron.
- Lacak Pesanan menampilkan alasan pembatalan.
- Migrasi baru: `migrations/0011_cancel_return.sql`.
