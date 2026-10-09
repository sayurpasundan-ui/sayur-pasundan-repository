# Audit Kesiapan Tahap 4 — Sayur Pasundan (masih berjalan)

**Status: IN PROGRESS — belum dinyatakan selesai dan belum diuji end-to-end di Cloudflare.**

Dokumen ini memisahkan pemeriksaan yang benar-benar dijalankan dalam sesi audit ini dari hal yang masih memerlukan pengujian berikutnya. Ia bukan sertifikat bahwa aplikasi siap menerima pesanan.

## 1. Basis audit

- Repository sumber: Rev21 / Stage 3.
- Workbook acuan: `DATABASE SAYUR PASUNDAN REV 15.xlsx`.
- Target awal: pemeriksaan lokal, sesuai keputusan pemilik.
- Target deployment berikut: GitHub + Cloudflare Pages preview; belum ada deployment live yang telah dibuktikan.
- Email otomatis dan SEO/performa lanjutan: ditunda.
- Cakupan tambahan: hanya kebutuhan yang penting untuk keamanan, konsistensi, dan persiapan peluncuran; tidak menambah multi-vendor, login pelanggan, atau fitur lain di luar model bisnis.

## 2. Perubahan yang disiapkan pada repository

1. **Pengembangan lokal yang eksplisit:** `wrangler.jsonc` menggunakan D1 bernama `sayur-pasundan-local` dan bindings lokal untuk `PRODUCT_IMAGES` dan `PAYMENT_PROOFS`. File ini tidak menetapkan `pages_build_output_dir`, agar pengaturan proyek Pages production nanti tetap berasal dari dashboard.
2. **Pemeriksaan secret admin:** login menolak nilai `SESSION_SECRET` di bawah 32 karakter atau placeholder contoh, dan `ADMIN_PASSWORD` di bawah 12 karakter atau placeholder contoh. Pengelolaan secret di Cloudflare tetap harus dilakukan manual sebagai Secret, bukan nilai publik.
3. **Validasi upload foto produk:** hanya JPEG/PNG/WebP/AVIF dengan MIME yang diizinkan serta signature file yang sesuai; dibatasi 6 MiB, admin harus terautentikasi, dan request mutasi harus same-origin.
4. **Bukti pembayaran:** jalur upload mempertahankan batas 2 MiB dan pengecekan signature JPEG/PNG/PDF yang sudah ada; pembacaan bukti dilindungi sesi admin serta header `private, no-store`.
5. **Perlindungan Origin untuk mutasi:** helper `sameOrigin()` menolak header Origin yang tidak ada, bernilai `null`, atau berbeda origin. Endpoint browser mutasi perlu diuji di preview untuk memastikan seluruh alur tetap mengirim Origin.
6. **ID pesanan:** order baru menggunakan 12 karakter hex acak setelah prefix/timestamp; halaman tracking menerima suffix 6–12 karakter agar order lama tetap bisa dilacak.
7. **WhatsApp tracking:** nomor WhatsApp hasil pengaturan toko di database diprioritaskan, dengan environment variable sebagai fallback.
8. **Mode stok:** Admin Panel hanya menawarkan `unlimited` dan API menolak `tracked`, karena checkout belum melakukan kontrol stok fisik per satuan. Ini mencegah Admin menyimpan opsi yang tidak bisa dipenuhi checkout.
9. **Header:** `public/_headers` menambahkan kebijakan keamanan dasar seperti `nosniff`, `X-Frame-Options`, dan no-store untuk admin/API. Header efektif tetap harus diverifikasi di preview.
10. **Impor remote lebih aman:** skrip SQL impor lokal menggunakan `apply-all-local.ps1`; skrip remote meminta nama database secara eksplisit dan konfirmasi ketik ulang sebelum menjalankan batch, tidak diam-diam mengarah ke D1 produksi.
11. **Health endpoint:** tidak lagi mengirim rincian error database internal dalam body publik.
12. **CI:** ditambahkan pemeriksaan Tahap 4 berbasis Node ke workflow validasi.
13. **Dokumentasi:** panduan deployment langkah demi langkah lokal → GitHub → Cloudflare dan audit kesiapan.

## 3. Hasil pemeriksaan yang benar-benar dijalankan pada Rev22

Pemeriksaan lokal berikut telah dijalankan pada kode yang dikemas:

| Pemeriksaan | Hasil | Makna |
|---|---|---|
| Sintaks JavaScript | **PASS — 57 file** | Semua file `.js` / `.mjs` yang ditemukan lolos `node --check`. |
| Stage 1 | **PASS** | Pemeriksaan statis homepage/katalog/aset. |
| Stage 2 | **PASS** | Pemeriksaan statis ongkir, checkout, pembayaran dan bukti. |
| Stage 3 | **PASS** | Pemeriksaan statis checkout dan Admin Panel. |
| Stage 4 | **PASS** | Pemeriksaan validasi signature, Origin, sesi HMAC, secret, stok, config lokal dan header. |
| Skema SQL | **PASS** | Empat file migrasi, 15 tabel dan foreign keys diperiksa oleh script lokal. |
| Audit workbook Excel Rev15 | **BELUM DIJALANKAN ULANG** | ExcelJS belum tersedia; `npm install --ignore-scripts` pada sesi audit mengalami timeout. |
| Server `wrangler pages dev` | **BELUM DIJALANKAN** | Dependensi belum terpasang pada lingkungan ini. |
| Pages + D1/R2 Cloudflare | **BELUM DIVERIFIKASI** | Tidak ada deployment atau pengujian cloud. |

Untuk mengulangi pemeriksaan otomatis dari root repository setelah `npm install` berhasil:

```powershell
npm run check:js
npm run check:stage1
npm run check:stage2
npm run check:stage3
npm run check:stage4
python scripts/check-schema.py
```

Audit workbook harus dilakukan terpisah dengan `npm run audit:excel -- "data/source/DATABASE SAYUR PASUNDAN REV 15 - ORIGINAL.xlsx"`. Pemeriksaan JS/stage4 bersifat statis/unit dan hanya memberi bukti terbatas, bukan pengujian jaringan dan transaksi nyata.

## 4. Batasan yang sudah diketahui

- **Audit workbook Rev15 belum berhasil dijalankan ulang pada lingkungan audit ini**, karena dependensi `exceljs` belum tersedia dan pemasangan dependensi mengalami timeout. Jangan anggap laporan lama sama dengan laporan terkini dari eksekusi ulang. Pengguna perlu menjalankan `npm install`, lalu `npm run audit:excel -- "data/source/DATABASE SAYUR PASUNDAN REV 15 - ORIGINAL.xlsx"` dan meninjau hasil sebelum impor lokal/preview.
- Repositori yang diekstrak tidak memiliki direktori `.git`; pengguna perlu membuat/menerbitkan Git repository sendiri melalui GitHub Desktop atau Git CLI.
- Belum ada bukti konfigurasi binding D1/R2 pada dashboard, pengaturan secrets cloud, deployment Pages, atau order uji nyata.
- Belum dilakukan pengujian end-to-end pada D1/R2 Cloudflare.
- Belum ada bukti pemulihan backup/restore D1 dan file R2.
- Belum dikonfigurasi rate limiting / anti-spam Cloudflare.
- Email otomatis, SEO/performa lanjutan, dan invoice PDF otomatis ditunda.
- Jenis promo `percentage` / `fixed_amount` tidak boleh diasumsikan mengurangi total checkout; perlu logika checkout dan test tersendiri sebelum promosi diskon diiklankan.
- Auto-cancel 24 jam mengandalkan Worker terpisah dengan Cron; kode Worker, D1 binding, target database, dan perilaku race perlu diverifikasi di preview sebelum aktif produksi.
- Penghitungan jarak dikendalikan server berdasarkan koordinat yang diproses dari input pembeli. Perlu diuji untuk format Google Maps beragam, koordinat tidak valid, jarak tepat 3 km, dan kemungkinan koordinat palsu. Jangan menyebut geolokasi sebagai bukti alamat tinggal.
- Belum ada pengukuran nyata untuk SEO, Core Web Vitals, performa di koneksi lambat, atau aksesibilitas lintas perangkat.

## 5. Urutan yang disarankan agar tidak tes berulang

### Gerbang 1 — Fondasi lokal

- [ ] Dependensi terpasang tanpa error.
- [ ] Workbook Rev15 diaudit ulang dan laporan tindakan ditinjau.
- [ ] Empat migrasi berjalan pada D1 lokal yang bersih.
- [ ] Impor lokal dilakukan hanya setelah `CLEANUP_REPORT.md` diperiksa.
- [ ] Semua pemeriksaan `check:js`, `check:stage1`, `check:stage2`, `check:stage3`, `check:stage4`, dan `check-schema.py` lulus.
- [ ] `/`, `/api/health`, katalog, Admin login, upload lokal, dan halaman lacak dapat dibuka di `localhost`.

### Gerbang 2 — Preview Cloudflare

- [ ] Repository privat GitHub, tanpa `.dev.vars` atau workbook.
- [ ] Pages preview terhubung ke branch pengembangan.
- [ ] Binding `DB`, `PRODUCT_IMAGES`, `PAYMENT_PROOFS` benar dan resource preview terpisah dari produksi.
- [ ] Secrets preview disimpan sebagai secrets, bukan dalam file/JS.
- [ ] Migrasi preview dan impor data preview dilakukan sekali ke target yang benar.
- [ ] Header, login admin, dan semua API inti memberikan respons yang diharapkan.

### Gerbang 3 — Uji menyeluruh (setelah Gerbang 1 dan 2 siap)

Uji satu skenario setiap alur dan catat bukti hasil:

- [ ] Checkout transfer dengan barang, kode unik, jumlah transfer, dan tenggat 24 jam.
- [ ] Upload JPG/PNG/PDF <= 2 MiB, file format palsu, tipe tidak diizinkan, dan >2 MiB.
- [ ] Admin menerima/menolak bukti, ubah status, dan bukti tidak dapat dibaca oleh pembeli tanpa sesi admin.
- [ ] Order expired dibatalkan hanya jika belum dibayar; cek race antara upload bukti dan expiry.
- [ ] COD hanya pada empat kecamatan, Kabupaten Bandung/Jawa Barat, total termasuk ongkir <= Rp200.000, serta lokasi koordinat diperlukan.
- [ ] Ongkir gratis pada subtotal >= Rp50.000; ongkir dekat/jauh di bawah ambang; jarak pada batas 3 km.
- [ ] Kode order baru dan kode order lama dapat dilacak dengan nomor WhatsApp yang benar; nomor salah tidak membocorkan pesanan.
- [ ] Admin tidak dapat mengubah mode stok fisik yang tidak didukung.
- [ ] XSS dasar pada nama produk/catatan, percobaan request lintas origin, sesi invalid/expired, upload palsu, dan akses bukti tanpa login.
- [ ] Konfigurasi worker expiry, backup dan recovery diuji sebelum produksi.

### Gerbang 4 — Go/no-go produksi

Produksi hanya dipertimbangkan setelah tidak ada isu kritis/tinggi terbuka, semua hasil uji dicatat, resource production terpisah dan benar, backup/pemulihan dicoba, rate limiting ditinjau, syarat privasi/penanganan data pelanggan ditinjau, serta pemilik secara eksplisit menyetujui transisi ke production. Custom domain tetap belum dipasang sampai keputusan tersebut dibuat.

## 6. Klasifikasi hasil

- **PASS kode/lokal:** pemeriksaan otomatis atau perilaku lokal terbukti pada lingkungan lokal.
- **PASS preview:** perilaku terbukti dengan Pages Functions serta D1/R2 preview yang sungguh terhubung.
- **BELUM DIVERIFIKASI:** belum ada output atau bukti untuk lingkungan itu.
- **GAGAL:** ditemukan perilaku yang bertentangan dengan spesifikasi.

Jangan mengganti `BELUM DIVERIFIKASI` menjadi `PASS` hanya karena berkas kode tersedia.
