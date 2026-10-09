-- Tahap 3: Dashboard Admin, pengaturan toko, banner, promo, dan pin Google Maps pelanggan.
-- Jalankan setelah migrations/0001, 0002, dan 0003.

ALTER TABLE orders ADD COLUMN customer_province TEXT NOT NULL DEFAULT 'Jawa Barat';
ALTER TABLE orders ADD COLUMN customer_map_url TEXT;

CREATE TABLE IF NOT EXISTS store_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO store_settings(setting_key, setting_value) VALUES
 ('store_name','SAYUR PASUNDAN'),
 ('tagline','Rencanakan Masakan Anda'),
 ('whatsapp_phone','081221031765'),
 ('store_email','sayurpasundan@gmail.com'),
 ('warehouse_address','Jl Panggilingan, Kp Pasir Angin, Desa Sukamantri, Kecamatan Paseh, Kabupaten Bandung, Jawa Barat 40383'),
 ('warehouse_lat','-7.059522'),
 ('warehouse_lng','107.764035'),
 ('free_shipping_minimum','50000'),
 ('near_shipping_fee','5000'),
 ('far_shipping_fee','10000'),
 ('near_radius_km','3'),
 ('transfer_expiry_hours','24'),
 ('cod_max_order_total','200000'),
 ('cod_allowed_districts','Paseh,Majalaya,Solokan Jeruk,Ciparay'),
 ('cod_allowed_city','Kabupaten Bandung'),
 ('cod_allowed_province','Jawa Barat'),
 ('cod_enabled','1');

CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  alt_text TEXT,
  image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  link_url TEXT,
  position TEXT NOT NULL DEFAULT 'hero' CHECK(position IN ('hero','promo','footer')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_banners_active_position_order ON banners(is_active,position,sort_order);

CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  promo_type TEXT NOT NULL DEFAULT 'display_only' CHECK(promo_type IN ('display_only','percentage','fixed_amount')),
  promo_value REAL NOT NULL DEFAULT 0 CHECK(promo_value >= 0),
  promo_code TEXT,
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_promotions_active_dates ON promotions(is_active,starts_at,ends_at,sort_order);
