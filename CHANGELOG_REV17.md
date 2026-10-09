# Changelog Rev17

## Fokus
Pembersihan dataset terbaru agar katalog bisa dikembangkan dan disiapkan untuk impor tanpa mengarang ID atau foto.

## Data
- Membersihkan dataset dalam memori saat audit/impor; workbook sumber asli tidak diubah.
- Menghapus Pakcoy ID 1031 yang ambigu/tidak memiliki varian; mempertahankan Pakcoy ID 1482 yang punya rantai jual valid.
- Menghapus varian ID 2038 yang merujuk ke produk yang tidak ada dan baris Royco Sapi yang kehilangan `id_varian`.
- Menghapus satuan orphan terkait varian yang dihapus/tidak ditemukan dan relasi rekomendasi ke produk yang dibuang.
- Melewati referensi foto kosong atau path yang file-nya tidak tersedia; foto produk akan diunggah manual melalui Admin Panel. Tidak dibuat placeholder foto palsu.
- Produk valid yang belum mempunyai varian/satuan jual dipertahankan sebagai draft.
- Membuat `generated/import/CLEANUP_REPORT.md` untuk melacak tindakan saat skrip impor dijalankan.

## Importer
- Audit menolak nama produk duplikat dan slug duplikat, serta mewajibkan slug produk.
- Audit memberi peringatan untuk produk aktif tanpa varian/satuan jual.

## Pengaturan toko
Batas COD default tetap Rp200.000. Integrasi COD dan checkout lengkap belum diklaim aktif.
