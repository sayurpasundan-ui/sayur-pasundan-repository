# Catatan perubahan Rev14 — Homepage Refresh

## Website pelanggan
- Menggunakan logo aplikasi yang disediakan pada header/footer dan favicon/PWA icons.
- Mengganti ilustrasi hero generik menjadi slider 4 banner dari aset pengguna, dengan sumber gambar berbeda untuk desktop (sekitar 2:1) dan mobile (4:3).
- Menambahkan navigasi desktop, area informasi ongkir, enam ikon kategori yang terhubung ke pemfilteran kategori, lima aset keunggulan, serta banner ajakan belanja dengan background brand.
- Menjaga ID elemen penting yang dibutuhkan pencarian, katalog, keranjang, checkout, WhatsApp, dan API tetap tersedia.
- Mengoptimalkan gambar dekoratif ke WebP dan memperbarui cache service worker.

## Admin Panel
- Menyamakan logo dan tampilan header dengan identitas Sayur Pasundan.
- Mempertahankan flow login, produk, varian, satuan/harga, foto produk, dan pesanan yang sudah ada.

## Batasan yang masih berlaku
- Banner dan teks di dalam gambar adalah aset statis di repository; belum ada editor banner/background homepage di Admin Panel.
- Database Rev13 belum diimpor. Perbaiki relasi orphan yang dicatat dalam `REV15_AUDIT.md` sebelum melakukan impor ke D1.
- Website belum dipublikasikan ke GitHub/Cloudflare dari sini; paket ini berisi perubahan kode dan aset untuk Anda unggah ke repository.
