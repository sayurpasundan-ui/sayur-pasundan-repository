-- Rev 27: data pembatalan/retur dan pengurang laporan penerimaan uang.
ALTER TABLE orders ADD COLUMN cancel_reason_code TEXT;
ALTER TABLE orders ADD COLUMN cancelled_stage TEXT;
ALTER TABLE orders ADD COLUMN refund_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN returned_at TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_returned_at ON orders(returned_at);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at);
