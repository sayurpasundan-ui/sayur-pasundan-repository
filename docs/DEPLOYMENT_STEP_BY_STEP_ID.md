# Panduan Lengkap Tahap 4 — Lokal, GitHub, dan Cloudflare

Panduan ini ditujukan untuk pemilik toko yang baru pertama kali melakukan deployment. Ikuti berurutan. **Selesaikan pemeriksaan lokal lebih dulu; jangan menghubungkan domain pelanggan atau memakai D1 produksi untuk uji coba.**

## Status dan prinsip kerja

- Sumber kerja: repositori Rev21 yang disiapkan untuk Tahap 4 dan workbook `DATABASE SAYUR PASUNDAN REV 15.xlsx`.
- Urutan: persiapkan komputer → konfigurasi lokal → migrasi database lokal → audit/impor data lokal → pemeriksaan kode → jalankan website lokal → baru unggah kode ke GitHub → buat Cloudflare Pages preview.
- `wrangler.jsonc` dalam paket ini sengaja merupakan konfigurasi **lokal**, tanpa `pages_build_output_dir`. Pengaturan deployment Pages nantinya dikelola di Dashboard Cloudflare.
- D1 lokal dan R2 lokal/emulasi tidak sama dengan database/file di akun Cloudflare. Perintah lokal menggunakan `--local`; jangan menggantinya menjadi `--remote` selama mengikuti bagian lokal.
- `ADMIN_PASSWORD` dan `SESSION_SECRET` tidak boleh diunggah ke GitHub. Jangan pernah mengirimkan nilainya melalui chat atau menaruhnya dalam screenshot.

---

## Bagian A — Siapkan komputer Windows

### A1. Pasang perangkat lunak

1. Pasang **Node.js 22 LTS atau versi LTS yang lebih baru** dari [nodejs.org](https://nodejs.org/). npm ikut terpasang.
2. Buka PowerShell, jalankan:

   ```powershell
   node --version
   npm --version
   ```

   Perintah pertama sebaiknya menunjukkan versi `v22.x.x` atau LTS yang lebih baru. Jika `node` tidak ditemukan, tutup dan buka kembali PowerShell setelah instalasi.
3. Opsional tetapi disarankan: pasang [Visual Studio Code](https://code.visualstudio.com/) untuk mengedit file dan [GitHub Desktop](https://desktop.github.com/) untuk menerbitkan repository tanpa mengetik perintah Git secara manual.

### A2. Ekstrak repository pada folder yang mudah ditemukan

1. Ekstrak ZIP repository Tahap 4 ke folder, misalnya `C:\Projects\sayur-pasundan`.
2. Pastikan folder yang dibuka adalah **root repository**. Pada folder yang benar, file `README.md`, `package.json`, `wrangler.jsonc`, serta folder `functions`, `public`, dan `migrations` berada langsung di dalamnya.
3. Di File Explorer, buka folder itu, klik bilah alamat, ketik `powershell`, lalu tekan Enter. PowerShell akan terbuka pada folder repository.
4. Periksa lokasi kerja:

   ```powershell
   Get-Location
   Get-ChildItem package.json, README.md, wrangler.jsonc
   ```

   Jika file tidak ditemukan, Anda mungkin sedang berada satu folder terlalu tinggi atau terlalu dalam.

### A3. Buat file rahasia lokal

1. Salin contoh konfigurasi:

   ```powershell
   Copy-Item .dev.vars.example .dev.vars
   ```

2. Buat secret acak untuk sesi admin. Perintah ini hanya mencetak nilai ke terminal lokal:

   ```powershell
   node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(48).toString('base64url'))"
   ```

3. Buka `.dev.vars` di editor. Ganti nilai contoh `ADMIN_PASSWORD` dengan kata sandi lokal yang kuat, minimal 12 karakter. Ganti `SESSION_SECRET` dengan hasil perintah di atas (lebih dari 32 karakter). Jangan meninggalkan teks `GANTI_DENGAN_...`.
4. Pertahankan nilai usaha yang telah disepakati: nama `SAYUR PASUNDAN`, tagline `Rencanakan Masakan Anda`, nomor WhatsApp toko, batas COD Rp200.000, dan daftar kecamatan COD Paseh, Majalaya, Solokan Jeruk, Ciparay.
5. Simpan file. **Jangan jalankan `git add .dev.vars`; file itu khusus lokal dan sudah masuk `.gitignore`.**

### A4. Pasang dependensi proyek

Dari root repository jalankan:

```powershell
npm install
```

Tunggu sampai selesai tanpa error. Perintah ini mengunduh dependensi yang diperlukan untuk mengembangkan lokal, termasuk Wrangler dan ExcelJS. `npm install` memerlukan internet. Bila gagal, catat pesan error lengkap (hapus token/secret jika ada), periksa koneksi, lalu ulangi. Jangan menghapus `package.json` sebagai solusi.

---

## Bagian B — Siapkan database lokal

### B1. Jalankan empat migrasi ke D1 lokal

Pastikan terminal masih berada di root repository. Jalankan satu per satu dan pastikan setiap perintah selesai tanpa error:

```powershell
npx wrangler d1 execute sayur-pasundan-local --local --file=migrations/0001_initial.sql
npx wrangler d1 execute sayur-pasundan-local --local --file=migrations/0002_checkout_payments.sql
npx wrangler d1 execute sayur-pasundan-local --local --file=migrations/0003_confirmed_payment_and_cod_areas.sql
npx wrangler d1 execute sayur-pasundan-local --local --file=migrations/0004_admin_stage3.sql
```

Urutannya penting. Jalankan pada database lokal yang baru dibuat; jangan mengulang migrasi `ALTER TABLE` pada database yang sudah menerapkannya. Jika Anda sudah pernah menjalankan migrasi sebelumnya, hentikan dan periksa dulu skema/tabel yang telah ada daripada menjalankan ulang secara membabi buta.

### B2. Verifikasi bahwa tabel tersedia

```powershell
npx wrangler d1 execute sayur-pasundan-local --local --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
python scripts/check-schema.py
```

Pastikan terdapat tabel transaksi, seperti `orders`, `order_items`, `payment_methods`, `payment_proofs`, `payment_refs`, dan `order_status_history`, serta tabel admin seperti `products`, `variants`, `sale_units`, `store_settings`, `banners`, dan `promotions`. Skrip skema harus berakhir tanpa error.

### B3. Audit workbook Excel Rev15

Workbook sumber lokal berada di:

`data/source/DATABASE SAYUR PASUNDAN REV 15 - ORIGINAL.xlsx`

Audit dulu sebelum membuat SQL impor:

```powershell
npm run audit:excel -- "data/source/DATABASE SAYUR PASUNDAN REV 15 - ORIGINAL.xlsx"
```

Baca seluruh peringatan/error terminal. Aturan proyek adalah melewati baris produk/varian/satuan yang mempunyai ID atau relasi ambigu, serta tidak membuat foto pengganti untuk foto yang hilang. Workbook sumber tidak diubah.

Jika audit tidak memiliki error yang menghalangi impor dan kebijakan pembersihan sesuai, buat berkas impor:

```powershell
npm run import:excel -- "data/source/DATABASE SAYUR PASUNDAN REV 15 - ORIGINAL.xlsx"
```

Kemudian:

1. Buka `generated/import/CLEANUP_REPORT.md`.
2. Tinjau jumlah record dan semua baris yang dilewati. Produk tanpa kombinasi varian/satuan jual valid dapat diturunkan menjadi draft sesuai kebijakan skrip.
3. Pastikan tidak ada foto kategori yang dipakai untuk menggantikan foto produk. Foto tidak tersedia tetap kosong.
4. Jalankan impor lokal saja:

   ```powershell
   .\generated\import\apply-all-local.ps1
   ```

5. Perintah tersebut menulis data ke D1 lokal bernama `sayur-pasundan-local`. Jangan menjalankan `apply-all.ps1` pada bagian ini; file itu khusus D1 remote dan meminta nama database serta konfirmasi tambahan.

Jika file workbook tidak ada di folder `data/source`, salin workbook Rev15 ke lokasi tersebut atau gunakan path yang benar. Jangan unggah workbook ke GitHub; berkas Excel sengaja dikecualikan dari Git.

---

## Bagian C — Pemeriksaan kode dan menjalankan website lokal

### C1. Jalankan pemeriksaan otomatis

```powershell
npm run check:js
npm run check:stage1
npm run check:stage2
npm run check:stage3
npm run check:stage4
python scripts/check-schema.py
```

Setiap perintah harus berakhir tanpa error. Pemeriksaan ini mencakup sintaks JavaScript dan beberapa validasi statis/unit untuk aturan bisnis, keamanan upload dan sesi, header, skema, serta konfigurasi lokal. **Kelulusan pemeriksaan ini belum membuktikan bahwa seluruh alur pengguna telah berhasil.** Pengujian end-to-end baru dilakukan setelah fondasi Tahap 4 siap.

### C2. Jalankan server lokal

```powershell
npm run dev
```

Lihat URL `localhost` yang ditulis di terminal; default dari konfigurasi ini biasanya `http://localhost:8788`. Jangan tutup terminal selama pengujian lokal.

Buka tab browser dan periksa:

- `http://localhost:8788/` — halaman toko.
- `http://localhost:8788/api/health` — status koneksi D1.
- `http://localhost:8788/api/categories` — kategori; bisa kosong bila data Excel belum diimpor.
- `http://localhost:8788/admin/` — panel admin.

Masuk admin menggunakan `ADMIN_PASSWORD` dari `.dev.vars`. Kalau halaman katalog masih kosong, pastikan tahap impor lokal berhasil. Kalau `/api/health` melaporkan database belum terhubung, hentikan server, periksa konfigurasi dan migrasi, lalu jalankan kembali.

### C3. Hal yang harus tetap lokal dulu

- Jangan lakukan pembelian sungguhan; ini hanya lingkungan pengembangan.
- Jangan gunakan kredensial produksi pada `.dev.vars`.
- Jangan menaruh bukti pembayaran asli atau data pelanggan nyata ke lingkungan ini.
- Jangan mengubah `--local` menjadi `--remote` untuk “memperbaiki” error lokal.
- Bucket R2 lokal/emulasi berbeda dari bucket Cloudflare. Upload lokal bukan bukti bahwa R2 cloud sudah siap.

---

## Bagian D — Terbitkan kode ke GitHub (setelah tahap lokal cukup stabil)

### D1. Buat repository privat

1. Masuk ke [GitHub](https://github.com/).
2. Buat repository baru bernama `sayur-pasundan` dan pilih **Private** selama pengembangan.
3. Jangan pilih opsi untuk membuat README atau `.gitignore` baru jika semua berkas itu sudah ada dalam folder proyek, agar tidak terjadi konflik.

### D2. Inisialisasi dan publish dengan GitHub Desktop

1. Buka GitHub Desktop dan masuk ke akun GitHub Anda.
2. Pilih **File → Add Local Repository** lalu pilih folder root proyek.
3. Bila GitHub Desktop menyatakan folder belum menjadi repository Git, pilih opsi untuk membuat repository di folder tersebut. Pastikan lokasi repository adalah folder yang berisi `package.json`, bukan folder pembungkus ZIP.
4. Tinjau daftar perubahan. Pastikan **tidak** ada `.dev.vars`, berkas `.xlsx`, data pelanggan, atau bukti pembayaran di daftar berkas untuk di-commit. `.gitignore` mengabaikan `.dev.vars` dan `*.xlsx`.
5. Isi pesan commit, misalnya `Prepare Stage 4 local foundation`, lalu klik **Commit to main**.
6. Klik **Publish repository**. Pilih repository `sayur-pasundan` dan pastikan opsi **Keep this code private** aktif.
7. Buka repository di GitHub → tab **Actions**. Tunggu workflow validasi hijau. Jika merah, buka job yang gagal dan catat nama pemeriksaan serta error-nya sebelum melanjutkan.

### Alternatif lewat PowerShell

Gunakan cara ini hanya bila Git CLI sudah terpasang. Jalankan dari root repository:

```powershell
git init -b main
git add .
git status --short
```

Sebelum commit, pastikan `.dev.vars` dan workbook `.xlsx` tidak tercantum sebagai file staged. Lanjutkan:

```powershell
git commit -m "Prepare Stage 4 local foundation"
```

Lalu hubungkan/publish repository ke GitHub melalui GitHub Desktop. Jika Anda belum familiar dengan remote Git dan token akses, gunakan GitHub Desktop agar tidak perlu menaruh token di file atau perintah.

---

## Bagian E — Buat deployment preview di Cloudflare

Lakukan bagian ini **setelah lokal diperiksa**. Jangan menambahkan custom domain atau menerima pesanan pelanggan dahulu.

### E1. Hubungkan GitHub ke Cloudflare Pages

1. Masuk ke [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Buka **Workers & Pages** dan pilih membuat aplikasi Pages yang terhubung ke Git. Nama menu bisa sedikit berbeda mengikuti tampilan Dashboard terbaru.
3. Berikan izin GitHub bila diminta, lalu pilih repository `sayur-pasundan`.
4. Konfigurasikan proyek:
   - Framework preset: `None` atau `Other`.
   - Production branch: `main`.
   - Root directory: kosong/default (root repository).
   - Build command: kosong/tidak ada.
   - Build output directory: `public`.
5. Buat proyek. Deployment awal hanya membuktikan proses pengambilan kode dan penyajian aset statis; API akan belum berfungsi sampai D1/R2 dan secrets terpasang.
6. Untuk pengembangan berikutnya, buat branch `stage4-preview`, push perubahan ke branch tersebut, lalu gunakan URL preview yang diberikan Cloudflare. Pastikan Settings membedakan **Production** dan **Preview** environment.

### E2. Buat D1 dan R2 untuk preview

Buat resource preview yang terpisah dari produksi, misalnya:

- D1 preview: `sayur-pasundan-preview-db`.
- R2 gambar preview: `sayur-pasundan-preview-images`.
- R2 bukti pembayaran preview: `sayur-pasundan-preview-payment-proofs`.

R2 `preview-payment-proofs` berisi data sensitif. Jangan berikan custom domain publik dan jangan gunakan endpoint gambar publik untuk bucket bukti pembayaran.

Di Cloudflare Pages → Settings → Functions/Bindings (nama tab dapat berubah), pada environment **Preview**, tambahkan:

| Jenis binding | Nama binding di kode | Resource preview |
|---|---|---|
| D1 database | `DB` | `sayur-pasundan-preview-db` |
| R2 bucket | `PRODUCT_IMAGES` | `sayur-pasundan-preview-images` |
| R2 bucket | `PAYMENT_PROOFS` | `sayur-pasundan-preview-payment-proofs` |

Nama binding harus persis karena kode mencari `env.DB`, `env.PRODUCT_IMAGES`, dan `env.PAYMENT_PROOFS`. Simpan pengaturan, lalu lakukan redeploy preview bila diminta.

### E3. Tambahkan Variables dan Secrets preview

Pada environment **Preview**, tambahkan:

**Secrets** (bukan variables biasa):

- `ADMIN_PASSWORD`: kata sandi admin untuk preview, minimal 12 karakter dan berbeda dari password akun lain.
- `SESSION_SECRET`: secret acak minimal 32 karakter. Anda bisa membuatnya di PowerShell dengan perintah pada bagian A3.

**Variables**:

- `STORE_NAME` = `SAYUR PASUNDAN`
- `STORE_TAGLINE` = `Rencanakan Masakan Anda`
- `PUBLIC_WA_PHONE` = `6281221031765`
- `COD_MAX_ORDER_TOTAL` = `200000`
- `COD_ALLOWED_DISTRICTS` = `Paseh,Majalaya,Solokan Jeruk,Ciparay`
- `COD_ALLOWED_CITY` = `Kabupaten Bandung`
- `COD_ALLOWED_PROVINCE` = `Jawa Barat`

Jangan tempelkan secret ke GitHub issue, commit, variabel publik JavaScript, atau screenshot. Jangan salin password/secret di sini.

### E4. Terapkan migrasi ke database preview

1. Di terminal lokal pada root repo jalankan `npx wrangler login`, selesaikan proses login resmi di browser, lalu periksa akun dengan `npx wrangler whoami`.
2. Pastikan Anda mengetahui nama D1 preview yang benar dan memilih akun Cloudflare yang benar.
3. Jalankan setiap migrasi berikut satu kali, ke database preview saja:

   ```powershell
   npx wrangler d1 execute sayur-pasundan-preview-db --remote --file=migrations/0001_initial.sql
   npx wrangler d1 execute sayur-pasundan-preview-db --remote --file=migrations/0002_checkout_payments.sql
   npx wrangler d1 execute sayur-pasundan-preview-db --remote --file=migrations/0003_confirmed_payment_and_cod_areas.sql
   npx wrangler d1 execute sayur-pasundan-preview-db --remote --file=migrations/0004_admin_stage3.sql
   ```

4. Jangan menjalankan perintah itu lagi jika migrasi sudah berhasil diterapkan pada database yang sama. Jika ragu, berhenti dan periksa daftar tabel/kolom terlebih dahulu.
5. Audit dan buat batch SQL Excel seperti Bagian B3. Periksa `CLEANUP_REPORT.md`, lalu untuk mengimpor ke preview jalankan `generated/import/apply-all.ps1 -DatabaseName sayur-pasundan-preview-db`. Script akan meminta Anda mengetik ulang nama database sebagai konfirmasi. Perintah ini meng-upsert data; tidak menghapus data lama yang tidak ada pada workbook.
6. Pastikan `DB` pada **Preview bindings** mengarah ke database preview yang sama dengan target migrasi/impor.

> Perintah `--remote` mengubah database di akun Cloudflare. Sebelum mengeksekusinya, baca ulang nama target di layar. Jangan jalankan ke database produksi selama pengembangan.

### E5. Periksa preview deployment

Buka URL preview dari Cloudflare dan periksa `/`, `/api/health`, `/api/categories`, serta `/admin/`. Jangan mulai uji alur transaksi menyeluruh sebelum audit fondasi Tahap 4 dinyatakan cukup. Setelah itu, gunakan daftar pengujian end-to-end terpisah dan rekam setiap kegagalan dengan URL preview, waktu, langkah, pesan yang muncul, serta log tanpa data pelanggan/secret.

---

## Bagian F — Hal yang belum boleh diaktifkan langsung untuk pelanggan

- **Produksi:** siapkan D1 dan dua R2 bucket produksi terpisah nanti; jangan gunakan resource preview untuk transaksi pelanggan.
- **Custom domain:** pasang setelah preview lulus pengujian dan pengaturan produksi diperiksa.
- **Pembatalan transfer otomatis:** `workers/order-expiry.js` memakai Worker terpisah dengan Cron 15 menit. Contoh konfigurasi tersedia di `wrangler-order-expiry.example.jsonc`. Buat salinan config khusus dengan ID database yang benar dan deploy hanya ketika target/backup diverifikasi. Jangan deploy worker contoh dengan teks `GANTI_DENGAN_D1_DATABASE_ID`.
- **Rate limiting/anti-spam:** atur rule Cloudflare yang sesuai sebelum menerima pelanggan, khususnya pada login admin, pembuatan pesanan, tracking, dan unggah file. Panduan ini tidak mengklaim rate limit telah dikonfigurasi.
- **Bukti pembayaran:** pastikan bucket `PAYMENT_PROOFS` terpisah/privat; file hanya dapat dibaca lewat API admin yang terautentikasi.
- **Email otomatis dan SEO/performa lanjutan:** sengaja ditunda sesuai keputusan proyek.
- **Diskon otomatis:** promo yang hanya ditampilkan di laman belum berarti diskon terhitung pada checkout. Jangan mengiklankan kode promo sebagai potongan harga aktif sampai aturan checkout/validasi diskon dibuat dan diuji.
- **Invoice PDF otomatis:** belum menjadi syarat untuk langkah deployment ini; bila diperlukan, jadikan tugas terpisah setelah transaksi inti stabil.

## Dokumentasi Cloudflare resmi

- [Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)
- [Pages Functions bindings (D1/R2)](https://developers.cloudflare.com/pages/functions/bindings/)
- [Wrangler configuration untuk Pages Functions](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Pages Functions routing](https://developers.cloudflare.com/pages/functions/routing/)
- [D1 database](https://developers.cloudflare.com/d1/)
- [R2 storage](https://developers.cloudflare.com/r2/)

Antarmuka Cloudflare dapat berubah. Bila label menu berbeda, cari halaman untuk Pages project settings, environment (Production/Preview), bindings, variables, dan secrets; jangan mengubah nama binding yang dipakai kode.
