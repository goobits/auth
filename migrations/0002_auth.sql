-- Auth tables for @goobits/auth (D1 adapters)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  password TEXT,
  role TEXT,
  settings TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_account_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS oauth_accounts_user_id_idx
ON oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  tokens TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, provider),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at TEXT,
  ip TEXT,
  user_agent TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx
ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS verification_tokens_user_id_idx
ON verification_tokens(user_id);

CREATE INDEX IF NOT EXISTS verification_tokens_token_idx
ON verification_tokens(token);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  otp_hash TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS magic_link_tokens_email_idx
ON magic_link_tokens(email);

CREATE INDEX IF NOT EXISTS magic_link_tokens_token_hash_idx
ON magic_link_tokens(token_hash);

CREATE INDEX IF NOT EXISTS magic_link_tokens_otp_hash_idx
ON magic_link_tokens(otp_hash);

