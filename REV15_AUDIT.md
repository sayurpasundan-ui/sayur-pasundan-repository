> **Catatan status:** Dokumen ini adalah audit historis yang digantikan oleh aturan pembersihan Rev17. Untuk keputusan impor terkini, lihat `docs/DATA_AUDIT_REV15.md`, `docs/REV15_IMPORT.md`, dan laporan aktual `generated/import/CLEANUP_REPORT.md` setelah menjalankan skrip.

# Audit workbook DATABASE SAYUR PASUNDAN REV 15.xlsx

Tanggal pemeriksaan: 9 Oktober 2026. Workbook sumber dibaca tanpa mengubah berkas Excel aslinya.

## Ringkasan isi

| Sheet | Jumlah baris data |
|---|---:|
| Kategori | 6 |
| Produk | 470 |
| Varian_Produk | 632 |
| Satuan_Produk | 1.875 |
| Foto_Produk | 1.872 |
| Produk_Terkait | 2.109 |

## Error yang menahan impor

1. `Varian_Produk.id_varian=2038` dengan nama tampil `Baby pakcoy` mengacu ke `product_id=1048`, sedangkan Produk ID 1048 tidak ada.
2. `Satuan_Produk.id_satuan=471`, `472`, dan `473` mengacu ke `id_varian=2154`, sedangkan Varian ID 2154 tidak ada.
3. Satu baris Varian_Produk untuk `Royco Sapi` (produk 1544) tidak mempunyai `id_varian`.

Jangan mengarang ID pengganti atau menghapus baris sumber diam-diam. Impor ke D1 harus ditahan sampai pemilik memutuskan relasi yang benar dan audit diulang.

## Masalah kualitas lain

- Slug `pakcoy` terduplikasi pada Produk ID `1031` dan `1482`; keduanya bernama `Pakcoy` tetapi mempunyai SKU berbeda (`SAY-PRD-1031` dan `SAY-PRD-1482`). Tentukan apakah ini produk berbeda atau data duplikat, lalu tetapkan slug unik sebelum SEO final.
- Dari 1.872 baris Foto_Produk, 566 baris memiliki `image_url` berisi path lokal; semua 566 path tidak ditemukan di `public/` pada repository. Sebanyak 1.306 baris mempunyai `image_url` kosong.
- Sebanyak 940 baris Foto_Produk tidak mempunyai nilai `is_primary`.
- Empat baris varian tidak mempunyai status: satu baris juga kehilangan `id_varian` (Royco Sapi), sedangkan ID varian `2476`, `2477`, dan `2478` (Sosis Ayam Kanzler, Fiesta, dan Sonice) masih memiliki status kosong.
- Seluruh 470 produk memiliki `stock=999` dan `stock_status=In_stock`. Sesuai keputusan pemilik, 999 diperlakukan sebagai penanda `stock_mode=unlimited`, bukan stok fisik.
- Deskripsi kategori `Perlengkapan Dapur` berisi `Bahan kebutuhan pokok`; cocokkan kembali deskripsi dengan nama kategori.
- 180 relasi `frequently_bought` adalah data relasi pada workbook, bukan analitik dari riwayat transaksi nyata.

## Pemeriksaan yang lolos

- 470 produk; tidak ada ID Produk duplikat, SKU produk duplikat, atau slug kosong.
- Semua kategori produk mengarah ke ID kategori yang tersedia.
- 632 baris varian tidak mempunyai ID duplikat; kecuali satu baris yang ID-nya kosong, SKU varian yang terisi tidak duplikat.
- Semua 1.875 satuan mempunyai harga positif, dan semua relasi satuan valid kecuali ID 471–473.
- Semua relasi Foto_Produk yang memakai `ID_Varian` terarah ke ID varian yang ada; keterbatasan utamanya adalah path gambar kosong/hilang.
- Semua 2.109 relasi Produk_Terkait mengarah ke produk yang ada; tidak ditemukan hubungan produk ke dirinya sendiri atau pasangan relasi duplikat.
- Kolom nama, slug, deskripsi singkat, deskripsi lengkap, tips penyimpanan, dan ide memasak terisi pada seluruh produk.

## Keputusan operasional yang dipakai

- Nama: Sayur Pasundan; tagline: `Rencanakan Masakan Anda`.
- Gudang/origin: Jl. Panggilingan, Kp. Pasir Angin, Desa Sukamantri, Kecamatan Paseh, Kabupaten Bandung, Jawa Barat 40383; koordinat `-7.059522, 107.764035`.
- Gratis ongkir untuk subtotal minimal Rp50.000; subtotal di bawah Rp50.000 dikenai Rp5.000 hingga radius 3 km dan Rp10.000 di atas radius 3 km. Validasi area dan perhitungan jarak harus dilakukan server-side.
- Stok default `unlimited`; satu foto utama per produk.
- COD Bandung dan sekitarnya dengan total pesanan maksimum **Rp200.000**. Daftar kecamatan yang diterima masih harus ditentukan sebelum COD diaktifkan.
- Transfer manual kedaluwarsa setelah 24 jam.
- WhatsApp toko: `081221031765`.

## Status

Persiapan Tahap 1 boleh dilanjutkan. **Impor workbook ke D1 belum boleh dilakukan** sampai tiga kategori error relasi/ID di atas diselesaikan. Path foto yang hilang perlu diganti atau sengaja dibiarkan tidak digunakan sebelum katalog produk asli dipublikasikan.
