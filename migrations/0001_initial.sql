CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  short_description TEXT,
  description TEXT,
  tips_storage TEXT,
  cooking_ideas TEXT,
  stock REAL NOT NULL DEFAULT 0,
  stock_mode TEXT NOT NULL DEFAULT 'unlimited' CHECK (stock_mode IN ('unlimited','tracked')),
  stock_status TEXT NOT NULL DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock','low_stock','out_of_stock','pre_order')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS variants (
  id_varian INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  sku_varian TEXT NOT NULL UNIQUE,
  merk TEXT,
  nama_varian TEXT,
  nama_produk_tampil TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  keterangan TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sale_units (
  id_satuan INTEGER PRIMARY KEY,
  id_varian INTEGER NOT NULL REFERENCES variants(id_varian) ON UPDATE CASCADE ON DELETE RESTRICT,
  kode_satuan TEXT NOT NULL,
  nama_satuan TEXT NOT NULL,
  sale_type TEXT NOT NULL DEFAULT 'piece' CHECK (sale_type IN ('measure','piece','pack')),
  harga REAL NOT NULL DEFAULT 0 CHECK (harga >= 0),
  allow_nominal_purchase INTEGER NOT NULL DEFAULT 0 CHECK (allow_nominal_purchase IN (0,1)),
  nominal_min REAL CHECK (nominal_min IS NULL OR nominal_min >= 0),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  keterangan TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS product_photos (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
  source_variant_id INTEGER REFERENCES variants(id_varian) ON UPDATE CASCADE ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  product_name TEXT,
  sale_unit_label TEXT,
  is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS related_products (
  product_id INTEGER NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
  related_product_id INTEGER NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'related' CHECK (relation_type IN ('similar','related','recommended','frequently_bought')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, related_product_id, relation_type),
  CHECK (product_id <> related_product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  notes TEXT,
  total REAL NOT NULL DEFAULT 0 CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','delivering','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  id_satuan INTEGER REFERENCES sale_units(id_satuan) ON UPDATE CASCADE ON DELETE SET NULL,
  product_id INTEGER REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL,
  id_varian INTEGER REFERENCES variants(id_varian) ON UPDATE CASCADE ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_label TEXT,
  unit_label TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total REAL NOT NULL DEFAULT 0 CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_products_category_status_order ON products(category_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_stock_status ON products(stock_status);
CREATE INDEX IF NOT EXISTS idx_variants_product_status_order ON variants(product_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_sale_units_variant_status_order ON sale_units(id_varian, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_photos_product_primary ON product_photos(product_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_related_product_order ON related_products(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
