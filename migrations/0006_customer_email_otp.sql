ALTER TABLE customer_accounts
ADD COLUMN email_verified_at TEXT;

CREATE TABLE IF NOT EXISTS customer_email_otps (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE,
  otp_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (customer_id) REFERENCES customer_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_email_otps_expiry
ON customer_email_otps(expires_at);