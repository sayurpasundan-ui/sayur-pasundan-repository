# Audit dan impor workbook terbaru

Workbook terbaru yang diberikan pengguna disimpan tanpa diubah di `data/source/DATABASE SAYUR PASUNDAN REV 15 - ORIGINAL.xlsx`. Audit dan importer menerapkan pembersihan deploy otomatis ke salinan data di memori. Baris yang tidak valid tidak dikirim ke D1; workbook sumber tetap menjadi arsip asli.

## Langkah lokal

1. Pasang Node.js LTS.
2. Jalankan `npm install` dari root repository.
3. Audit sumber terbaru:
   `npm run audit:excel -- "data/source/DATABASE SAYUR PASUNDAN REV 15 - ORIGINAL.xlsx"`
4. Tinjau daftar tindakan pembersihan yang ditampilkan. Audit harus berakhir tanpa error.
5. Buat batch SQL dari dataset yang sudah dibersihkan:
   `npm run import:excel -- "data/source/DATABASE SAYUR PASUNDAN REV 15 - ORIGINAL.xlsx"`
6. Tinjau `generated/import/CLEANUP_REPORT.md` dan file SQL. Backup D1, pastikan target database dan binding benar, lalu jalankan `generated/import/apply-all.ps1` hanya setelah disetujui.

## Aturan pembersihan

- Identitas produk yang kosong/duplikat dibuang. Untuk nama/slug produk yang ambigu, satu-satunya kandidat yang memiliki varian dan satuan jual valid dapat dipertahankan; jika tidak ada tepat satu kandidat, kelompok ambigu dikeluarkan. Pada data ini, Pakcoy ID 1031 tidak memiliki varian sehingga dikeluarkan; Pakcoy ID 1482 dipertahankan.
- Varian dengan `id_varian` kosong atau `product_id` tidak valid dibuang. Satuan yang merujuk ke varian yang dibuang/tidak ditemukan ikut dikeluarkan.
- Produk valid tanpa varian/satuan jual disimpan sebagai `draft` agar tidak muncul pada katalog; produk tersebut dapat dilengkapi dari Admin Panel.
- Foto produk opsional. Path lokal tanpa file fisik tidak dikirim ke D1. Upload foto dilakukan manual setelah deployment; struktur mendukung satu foto utama per produk.
- Stok Excel bernilai `999` dipetakan menjadi `stock_mode=unlimited` oleh importer.

## Pengamanan penerapan

Importer membuat upsert dan tidak menghapus data lama yang tidak ada di workbook. Untuk database yang sudah berisi data, lakukan backup dan review batch SQL lebih dahulu. Jangan menjalankan impor remote sebelum migrasi dan binding D1 telah dikonfirmasi.
