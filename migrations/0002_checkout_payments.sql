-- Tahap 2: checkout tamu, estimasi ongkir radius, transfer manual, COD, pelacakan, dan bukti pembayaran.
-- Jalankan hanya setelah migration 0001_initial.sql pada database target.

ALTER TABLE orders ADD COLUMN customer_city TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN customer_district TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN customer_lat REAL;
ALTER TABLE orders ADD COLUMN customer_lng REAL;
ALTER TABLE orders ADD COLUMN subtotal REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN shipping_fee REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN distance_km REAL;
ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'legacy'
  CHECK (payment_status IN ('legacy','awaiting_payment','awaiting_verification','rejected','paid','cod_unpaid','cod_paid','expired','cancelled'));
ALTER TABLE orders ADD COLUMN payment_unique_code INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN payment_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN payment_due_at TEXT;
ALTER TABLE orders ADD COLUMN paid_at TEXT;
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
ALTER TABLE orders ADD COLUMN cancellation_reason TEXT;
ALTER TABLE orders ADD COLUMN cod_paid_at TEXT;

CREATE TABLE IF NOT EXISTS payment_methods (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bank_transfer','e_wallet','cod')),
  account_number TEXT,
  account_name TEXT,
  logo_url TEXT,
  instructions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS payment_proofs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','application/pdf')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  review_note TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_at TEXT
);

-- Menjaga nominal transfer yang masih menunggu pembayaran tetap unik.
CREATE TABLE IF NOT EXISTS payment_refs (
  payment_amount INTEGER PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  note TEXT,
  changed_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_payment_due ON orders(payment_status, payment_due_at);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_order_date ON payment_proofs(order_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_history_order_date ON order_status_history(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active_order ON payment_methods(is_active, sort_order);

-- Nomor rekening berasal dari data yang diberikan pemilik. Logo resmi tidak diubah/digambar ulang;
-- kolom logo_url sengaja NULL sampai aset berizin diunggah melalui penyimpanan/admin.
INSERT OR IGNORE INTO payment_methods (code,name,kind,account_number,account_name,logo_url,instructions,is_active,sort_order) VALUES
 ('bca','Bank BCA','bank_transfer','3760938407','Devi Triani Maresa',NULL,'Transfer sesuai nominal yang tertera, termasuk kode unik 3 digit.',1,1),
 ('seabank','SeaBank','bank_transfer','901067184249','Devi Triani Maresa',NULL,'Transfer sesuai nominal yang tertera, termasuk kode unik 3 digit.',1,2),
 ('dana','DANA','e_wallet','085808427577',NULL,NULL,'Kirim pembayaran ke nomor DANA ini sesuai nominal yang tertera.',1,3),
 ('cod','Bayar di Tempat (COD)','cod',NULL,NULL,NULL,'Pembayaran tunai saat pesanan diterima. COD hanya tersedia untuk kecamatan yang diaktifkan toko.',1,4);
