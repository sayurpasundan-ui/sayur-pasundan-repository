-- Tahap 2 follow-up: pemilik DANA dikonfirmasi dan daftar kecamatan COD disepakati.
-- Jalankan satu kali setelah 0001_initial.sql dan 0002_checkout_payments.sql.
UPDATE payment_methods
SET account_name = 'Devi Triani Maresa',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE code = 'dana';
