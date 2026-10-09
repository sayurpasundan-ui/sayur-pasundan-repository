"""Validate every D1 migration and important Stage 2 tables/seeds in an empty SQLite DB."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(":memory:")
conn.execute("PRAGMA foreign_keys = ON")
for sql_path in sorted((ROOT / "migrations").glob("*.sql")):
    conn.executescript(sql_path.read_text(encoding="utf-8"))
rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()
tables = {r[0] for r in rows}
required = {"categories", "products", "variants", "sale_units", "product_photos", "related_products", "orders", "order_items", "payment_methods", "payment_proofs", "payment_refs", "order_status_history", "store_settings", "banners", "promotions"}
missing = required - tables
if missing:
    raise SystemExit(f"Missing tables: {sorted(missing)}")
order_columns = {row[1] for row in conn.execute("PRAGMA table_info(orders)").fetchall()}
required_order_cols = {"customer_city", "customer_district", "customer_province", "customer_map_url", "subtotal", "shipping_fee", "distance_km", "payment_method", "payment_status", "payment_amount", "payment_due_at"}
if required_order_cols - order_columns:
    raise SystemExit(f"Missing orders columns: {sorted(required_order_cols - order_columns)}")
methods = {row[0] for row in conn.execute("SELECT code FROM payment_methods").fetchall()}
if not {"bca", "seabank", "dana", "cod"}.issubset(methods):
    raise SystemExit(f"Missing seeded payment methods: {methods}")
dana_owner = conn.execute("SELECT account_name FROM payment_methods WHERE code='dana'").fetchone()[0]
if dana_owner != "Devi Triani Maresa":
    raise SystemExit(f"Unexpected DANA account owner: {dana_owner!r}")
violations = conn.execute("PRAGMA foreign_key_check").fetchall()
if violations:
    raise SystemExit(f"Foreign key violations in empty schema: {violations}")
settings_keys = {r[0] for r in conn.execute("SELECT setting_key FROM store_settings").fetchall()}
if not {"cod_max_order_total", "cod_allowed_districts", "warehouse_lat", "warehouse_lng", "whatsapp_phone"}.issubset(settings_keys):
    raise SystemExit(f"Missing store settings seeds: {sorted(settings_keys)}")
print(f"OK: {len(list((ROOT / 'migrations').glob('*.sql')))} migrations run; {len(tables)} tables created; checkout/address map fields, payment method seeds, store settings, and foreign keys validated.")
