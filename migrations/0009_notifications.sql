-- Notifikasi otomatis (Web Push). Tabel ini juga dibuat otomatis oleh aplikasi saat pertama dipakai.
CREATE TABLE IF NOT EXISTS notify_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  hash TEXT NOT NULL, role TEXT NOT NULL, order_code TEXT NOT NULL DEFAULT '', endpoint TEXT NOT NULL,
  p256dh TEXT, auth TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (hash, role, order_code)
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_target ON push_subscriptions(role, order_code);
CREATE TABLE IF NOT EXISTS push_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT NOT NULL DEFAULT '/',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_push_messages_hash ON push_messages(hash, id);
