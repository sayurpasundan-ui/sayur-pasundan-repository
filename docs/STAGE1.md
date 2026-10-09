# Tahap 1 — Beranda, Katalog, dan Detail Produk

## Yang sudah disiapkan

1. Beranda mobile-first dengan logo, tagline, banner hero desktop/mobile, enam ikon kategori, benefit, section rekomendasi, footer, dan tautan WhatsApp.
2. Katalog dengan pencarian, saran nama, filter kategori/rentang harga/unggulan, pengurutan, pagination, pilihan varian dan satuan, serta tombol tambah ke keranjang browser.
3. URL filter dapat dibagikan, misalnya `/?kategori=sayuran&q=bayam&urut=price-asc`. Nilai kategori harus cocok dengan slug di tabel `categories`.
4. Detail produk mengambil data dari `/api/products`, menampilkan deskripsi, tips penyimpanan, ide memasak dan produk terkait. Foto dapat diperbesar jika URL foto valid.
5. Foto kosong atau URL tidak didukung tetap kosong; gambar ikon kategori tidak dipakai sebagai foto produk.

## Data yang ditampilkan

API hanya memublikasikan produk `active` yang memiliki varian aktif dan minimal satu satuan jual aktif. Produk draft atau produk tanpa satuan jual tidak muncul sampai dilengkapi melalui Admin. Section `Produk Terlaris` hanya tampil bila jumlah terjual tersedia dari transaksi yang benar-benar tercatat; tidak ada angka penjualan buatan.

## Menjalankan lokal

1. Pasang Node.js LTS.
2. Buka terminal pada folder repository lalu jalankan `npm install`.
3. Jalankan `npm run check:js`, `npm run check:stage1`, dan `python scripts/check-schema.py`.
4. Jalankan `npm run dev`. Untuk data katalog nyata, D1 lokal/preview harus dimigrasi dan diisi dari workbook yang sudah lolos audit. Tanpa binding/data, halaman menunjukkan status bahwa katalog belum tersambung.

## Belum termasuk di Tahap 1

- Impor workbook ke D1 dan deployment live.
- Checkout lengkap dengan ongkir radius, pembayaran transfer/COD, pembayaran kedaluwarsa, upload bukti, pelacakan status, invoice, notifikasi email/WhatsApp.
- Pengaturan hero dan promo dari Admin. Banner homepage masih berupa aset statis.
