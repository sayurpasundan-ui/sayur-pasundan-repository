# Model Data

## Relasi inti

```text
categories.id ← products.category_id
products.id ← variants.product_id
variants.id_varian ← sale_units.id_varian
products.id ← product_photos.product_id
variants.id_varian ← product_photos.source_variant_id (opsional)
products.id ← related_products.product_id
products.id ← related_products.related_product_id
orders.id ← order_items.order_id
sale_units.id_satuan ← order_items.id_satuan
```

## Tabel utama

- `categories`: kategori produk.
- `products`: nama/SKU/slug/kategori/deskripsi/stok/status produk utama.
- `variants`: merk/varian yang diturunkan dari produk, termasuk `id_varian` dan `sku_varian`.
- `sale_units`: satuan jual dan harga; termasuk jenis `piece`, `pack`, atau `measure` dan aturan nominal bebas.
- `product_photos`: satu foto utama untuk setiap produk (`product_id` unik), menyimpan `source_variant_id` opsional sebagai informasi asal foto. File fotonya sendiri bukan BLOB D1; berkas disimpan di `public/` atau R2.
- `related_products`: pasangan rekomendasi (`similar`, `related`, `recommended`, `frequently_bought`) dengan urutan tampilan.
- `orders` dan `order_items`: header pesanan dan snapshot nama/harga/kuantitas saat pesanan dibuat.

## ID dan SKU

- `products.id`, `variants.id_varian`, `sale_units.id_satuan` wajib unik dan stabil.
- `variants.product_id` harus mengacu ke `products.id`.
- `sale_units.id_varian` harus mengacu ke `variants.id_varian`.
- Perubahan nama/harga tidak memerlukan ID baru. Menambahkan varian/satuan baru memerlukan ID baru.

## Status

- Status katalog: `draft`, `active`, `archived`.
- Status stok: `in_stock`, `low_stock`, `out_of_stock`, `pre_order`.
- Stok berada pada level `products`, mengikuti workbook DATABASE SAYUR PASUNDAN REV 15. Semua nilai `stock=999` pada workbook tersebut dipetakan ke `stock_mode=unlimited` sesuai keputusan pemilik. Mode `tracked` untuk stok fisik masih perlu aturan penurunan per satuan/timbang sebelum otomatis digunakan pada transaksi.

## Nominal untuk produk timbang

Untuk `sale_type=measure` dengan `allow_nominal_purchase=1`, pelanggan bisa memasukkan nominal Rupiah bebas selama memenuhi `nominal_min`. Server menghitung kuantitas ekuivalen memakai harga satuan dan menyimpan nilai kuantitas/harga pada item order.
