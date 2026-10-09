# Arsitektur

```text
GitHub repository
  ├─ public/                  → aset statis katalog/Admin/PWA
  ├─ functions/api/           → Cloudflare Pages Functions
  └─ migrations/*.sql         → skema D1
          │
          ▼ push / Git integration
Cloudflare Pages
  ├─ static site: public/
  ├─ Functions: functions/
  ├─ binding DB             → Cloudflare D1
  └─ binding PRODUCT_IMAGES → Cloudflare R2
```

## Pembagian peran

- **GitHub:** versioning kode, review perubahan, riwayat commit, dan CI.
- **Cloudflare Pages:** menyajikan web/PWA dan menjalankan Pages Functions.
- **D1:** data relasional kategori, produk, varian, satuan, foto (metadata), rekomendasi, order, dan item order.
- **R2:** file foto produk yang diunggah melalui Admin.
- **Excel:** sumber bulk import saat awal dan saat migrasi data terkendali; file tidak disimpan ke Git.

## Prinsip

1. Kode deploy melalui Git; isi katalog berubah melalui database.
2. Server membaca harga resmi dari D1 ketika order dibuat. Harga dari browser tidak dianggap otoritatif.
3. ID relasional stabil; nama, status, urutan tampilan, deskripsi, dan harga dapat berubah sesuai aturan.
4. Impor divalidasi sebelum SQL dibuat. Baris relasi yang tidak memiliki parent ID tidak boleh diimpor.
5. Gunakan database lokal/preview selama pengembangan. Cadangkan database sebelum perubahan produksi.
