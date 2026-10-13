# Notifikasi otomatis

Sistem mengirim kabar otomatis tanpa biaya tambahan dan tanpa layanan pihak ketiga yang wajib.

## Siapa mendapat apa
| Kejadian | Admin | Pelanggan |
|---|---|---|
| Pesanan baru masuk | Ya | - |
| Bukti pembayaran diunggah | Ya | - |
| Pembayaran diverifikasi / bukti ditolak | - | Ya |
| Diproses, Dikirim, Selesai, COD diterima | - | Ya |
| Pesanan dibatalkan / batas bayar lewat | - | Ya |

Riwayat waktu setiap status tampil di halaman **Lacak Pesanan** dan **Pesanan**.

## 1. Notifikasi di HP (Web Push) - tanpa pengaturan
- **Admin**: buka `/admin/`, kartu "Kabar pesanan masuk" -> **Aktifkan notifikasi di HP ini** -> izinkan. Ketuk **Kirim notifikasi uji** untuk mengecek.
- **Pelanggan**: di halaman pesanan/lacak pesanan, ketuk **Aktifkan notifikasi status pesanan**.
- Kunci VAPID dibuat otomatis dan disimpan di D1 (tabel `notify_config`); tidak perlu secret.
- Android Chrome: bekerja langsung. iPhone: situs harus ditambahkan ke Layar Utama (iOS 16.4+).
- Notifikasi muncul meski situs sedang tidak dibuka (selama HP terhubung internet).

## 2. Telegram untuk admin (opsional)
1. Di Telegram, cari **@BotFather** -> `/newbot` -> salin token bot.
2. Kirim pesan apa saja ke bot baru Anda.
3. Buka `https://api.telegram.org/bot<TOKEN>/getUpdates` di browser, cari `"chat":{"id":123456789`.
4. Cloudflare -> proyek Pages -> Settings -> Variables and Secrets, tambahkan secret `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID`, lalu deploy ulang.

## 3. Email untuk admin (opsional)
Memakai Resend yang sudah dipakai untuk OTP. Tambahkan secret `ADMIN_NOTIFY_EMAIL` (alamat tujuan). `RESEND_API_KEY` sudah ada. Dengan pengirim bawaan `onboarding@resend.dev`, Resend hanya mau mengirim ke email pemilik akun Resend.

## 4. WhatsApp
WhatsApp otomatis penuh memerlukan WhatsApp Business API atau gateway berbayar. Sebagai gantinya, di dialog pesanan admin ada tombol **Kirim update via WhatsApp ke pelanggan** yang membuka WhatsApp dengan pesan siap kirim sesuai status pesanan.

## Catatan teknis
- Tabel dibuat otomatis: `notify_config`, `push_subscriptions`, `push_messages` (lihat `migrations/0009_notifications.sql`).
- Kegagalan notifikasi tidak pernah menggagalkan pesanan.
- Pembatalan otomatis oleh worker terjadwal juga mengirim notifikasi (worker perlu binding `DB` seperti sebelumnya).
