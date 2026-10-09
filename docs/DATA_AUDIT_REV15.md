# Audit data — Clean Deploy Rev17

Sumber: workbook terbaru yang diunggah pengguna, diarsipkan tanpa perubahan sebagai `data/source/DATABASE SAYUR PASUNDAN REV 15 - ORIGINAL.xlsx`. Baris ambigu/orphan dikeluarkan saat audit/impor; perubahan tidak ditulis balik ke file sumber. Laporan tindakan per eksekusi dibuat sebagai `generated/import/CLEANUP_REPORT.md`.

## Ringkasan temuan yang dibersihkan

- Pakcoy ID 1031 dikeluarkan karena slug/nama duplikat dan tidak mempunyai varian; Pakcoy ID 1482 dipertahankan karena mempunyai rantai varian dan satuan jual valid.
- Varian ID 2038 dikeluarkan karena `product_id=1048` tidak ditemukan.
- Baris Royco Sapi dikeluarkan karena `id_varian` kosong.
- Satuan ID 102–104 ikut dikeluarkan karena merujuk ke varian 2038; satuan ID 471–473 dikeluarkan karena merujuk ke varian 2154 yang tidak ditemukan.
- Relasi `Produk_Terkait` yang menunjuk ke produk yang dikeluarkan dihapus dari dataset impor.
- 24 produk tanpa varian/satuan jual dipertahankan sebagai `draft` dan tidak tampil di katalog sampai dilengkapi.
- Foto: 566 path lokal dalam workbook tidak mempunyai file gambar di repository dan 1.306 baris sumber tidak memiliki URL. Path yang tidak tersedia tidak diimpor; foto akan diunggah manual.

## Jumlah sumber dan dataset impor

| Data | Sumber | Setelah pembersihan (perkiraan dari audit sumber) |
|---|---:|---:|
| Produk | 470 | 469 |
| Kategori | 6 | 6 |
| Varian produk | 632 | 630 |
| Satuan jual | 1.875 | 1.869 |
| Foto produk | 1.872 baris referensi sumber | 0 foto diimpor sampai tersedia |
| Produk terkait | 2.109 | 2.095 |

Jumlah final dan tindakan aktual ditulis oleh skrip ke `CLEANUP_REPORT.md` saat audit/impor dijalankan.
