# MULAI DI SINI — Sayur Pasundan (Paket Tahap 4)

Paket ini disiapkan supaya pemilik toko tidak perlu menulis kode. **Untuk mengunggah kode ke GitHub, Anda tidak perlu memasang Node.js terlebih dahulu.** Node.js baru dibutuhkan ketika menjalankan pemeriksaan dan server lokal.

Status paket: **persiapan Tahap 4 — belum final dan belum terbukti berjalan di Cloudflare**.

## Bagian 1 — Ekstrak ZIP

1. Unduh ZIP repository.
2. Klik kanan file ZIP → **Extract All / Ekstrak Semua**.
3. Buka folder hasil ekstrak, lalu masuk ke folder `sayur-pasundan-repository`.
4. Pastikan di folder tersebut terlihat `README.md`, `package.json`, `wrangler.jsonc`, serta folder `functions`, `public`, dan `migrations`.

Jangan mengunggah file ZIP sebagai satu file ke GitHub. Yang diterbitkan adalah isi folder repository.

## Bagian 2 — Terbitkan ke GitHub tanpa mengetik perintah Git

1. Buat akun/masuk ke [GitHub](https://github.com/) jika belum.
2. Pasang [GitHub Desktop](https://desktop.github.com/) dan masuk menggunakan akun GitHub.
3. Di GitHub Desktop pilih **File → Add Local Repository** dan pilih folder `sayur-pasundan-repository`.
4. Jika diminta karena folder belum menjadi Git repository, pilih opsi untuk membuat repository di folder itu.
5. Periksa daftar file yang akan di-commit. **Jangan lanjut** jika `.dev.vars`, file `.xlsx`, data pelanggan, bukti pembayaran, atau secret muncul dalam daftar.
   - File `.xlsx` seharusnya diabaikan oleh `.gitignore`.
   - Jangan mengunggah workbook lewat tombol **Upload files** di website GitHub karena unggahan manual dari browser tidak menerapkan aturan `.gitignore`.
6. Isi ringkasan commit, misalnya `Prepare Sayur Pasundan Stage 4`, lalu klik **Commit to main**.
7. Klik **Publish repository**, beri nama `sayur-pasundan`, dan pastikan repository dibuat **Private**.
8. Buka repository di GitHub → **Actions**. Tunggu pemeriksaan otomatis selesai. Jika gagal, simpan nama job dan pesan errornya; jangan menaruh secret di screenshot.

Jika GitHub Desktop meminta memilih lokasi repository, gunakan folder yang langsung berisi `package.json`, bukan folder induk ZIP.

## Bagian 3 — Sebelum menghubungkan ke Cloudflare

Paket ini **belum merupakan deployment produksi**. Ikuti bagian A–C dalam `docs/DEPLOYMENT_STEP_BY_STEP_ID.md` untuk memasang Node.js, menyiapkan secret lokal, migrasi D1 lokal, audit workbook Rev15, dan pemeriksaan lokal. Jangan mengimpor data ke database cloud sebelum laporan pembersihan diperiksa.

## Bagian 4 — Hubungkan ke Cloudflare Preview

Setelah fondasi lokal siap, ikuti bagian D–F dalam `docs/DEPLOYMENT_STEP_BY_STEP_ID.md`. Buat lingkungan **Preview** dan resource terpisah untuk D1 dan R2. Jangan pasang domain pelanggan, jangan pakai database produksi untuk uji coba, dan jangan menerima pesanan nyata pada tahap ini.

## File panduan utama

- `docs/DEPLOYMENT_STEP_BY_STEP_ID.md` — petunjuk detail Windows, lokal, GitHub, dan Cloudflare.
- `docs/STAGE4_READINESS_AUDIT.md` — status audit, batasan, dan checklist sebelum uji menyeluruh.
- `docs/REV15_IMPORT.md` — alur audit dan impor Excel.

## Keamanan penting

- Jangan mengirim `ADMIN_PASSWORD`, `SESSION_SECRET`, token GitHub, atau kredensial Cloudflare melalui chat.
- Jangan commit `.dev.vars`.
- Workbook Rev15 disertakan di paket untuk proses lokal, tetapi harus tetap dikecualikan dari GitHub.
- Belum ada klaim bahwa deployment, D1/R2 cloud, checkout, pembayaran, atau pemulihan backup sudah berhasil diuji end-to-end.
