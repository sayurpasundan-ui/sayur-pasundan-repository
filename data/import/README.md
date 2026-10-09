# Data impor

Gunakan file `../source/DATABASE SAYUR PASUNDAN REV 15 - ORIGINAL.xlsx` sebagai input audit dan impor. File sumber disimpan tanpa perubahan.

Skrip `audit:excel` dan `import:excel` menerapkan aturan pembersihan yang sama ke dataset di memori, mengecualikan ID/relasi ambigu, menurunkan produk tanpa satuan jual ke status draft, dan tidak mengimpor path foto lokal yang tidak memiliki file fisik. Detail per eksekusi dibuat di `generated/import/CLEANUP_REPORT.md`.

Foto produk akan diunggah manual dari Admin Panel setelah konfigurasi storage/website siap.
