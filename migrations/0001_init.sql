-- disc-app-api initial schema. Identity layer that sits in front of agar-api.
-- agar-api owns tokens + balances; we own who-the-token-belongs-to.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  agar_token    TEXT,
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE INDEX idx_users_email ON users(email);

CREATE TABLE magic_links (
  code         TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  consumed_at  INTEGER
);

CREATE INDEX idx_magic_links_email_created ON magic_links(email, created_at DESC);
