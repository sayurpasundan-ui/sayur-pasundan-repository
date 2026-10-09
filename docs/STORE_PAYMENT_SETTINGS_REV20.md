# Pengaturan pembayaran dan area COD — Rev20

## Data pembayaran

- **BCA** — 3760938407 — Devi Triani Maresa
- **SeaBank** — 901067184249 — Devi Triani Maresa
- **DANA** — 085808427577 — Devi Triani Maresa
- **COD** — maksimum total pesanan Rp200.000 termasuk ongkir

Jalankan migrasi `0003_confirmed_payment_and_cod_areas.sql` satu kali setelah migrasi 0002 agar `account_name` DANA diperbarui pada D1.

## Area COD yang diizinkan

COD hanya tersedia untuk alamat dengan:
- Kecamatan: Paseh, Majalaya, Solokan Jeruk, atau Ciparay
- Kabupaten/Kota: Kabupaten Bandung
- Provinsi: Jawa Barat

Server menormalkan huruf besar/kecil dan spasi pada nama kecamatan. Untuk field kota/kabupaten, diterima `Kabupaten Bandung`, `Kab. Bandung`, atau `Kab Bandung`. COD tetap memerlukan koordinat pengantaran yang valid untuk estimasi jarak/ongkir.

Variabel non-rahasia disertakan dalam `wrangler.jsonc`:

```text
COD_MAX_ORDER_TOTAL=200000
COD_ALLOWED_DISTRICTS=Paseh,Majalaya,Solokan Jeruk,Ciparay
COD_ALLOWED_CITY=Kabupaten Bandung
```

Pastikan variable production di Cloudflare Pages sesuai. `ADMIN_PASSWORD` dan `SESSION_SECRET` tetap harus diatur sebagai secrets, bukan ditulis di file ini.

## Logo pembayaran

`logo_url` sengaja kosong sampai aset resmi yang diizinkan penggunaannya tersedia. UI menggunakan label teks sebagai gantinya; jangan menggambar ulang atau meregangkan logo untuk meniru logo bank/e-wallet.
