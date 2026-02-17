# Schema

## Magic link tokens

```sql
CREATE TABLE magic_link_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  otp_hash TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

CREATE INDEX magic_link_tokens_email_idx ON magic_link_tokens (email);
CREATE INDEX magic_link_tokens_token_hash_idx ON magic_link_tokens (token_hash);
CREATE INDEX magic_link_tokens_otp_hash_idx ON magic_link_tokens (otp_hash);
```

## WebAuthn

```sql
CREATE TABLE webauthn_credentials (
  credential_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX webauthn_credentials_user_idx ON webauthn_credentials (user_id);

CREATE TABLE webauthn_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX webauthn_challenges_user_idx ON webauthn_challenges (user_id);
CREATE INDEX webauthn_challenges_expires_idx ON webauthn_challenges (expires_at);
```

## Session metadata (optional)

```sql
ALTER TABLE sessions
  ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN last_active_at TIMESTAMP,
  ADD COLUMN ip TEXT,
  ADD COLUMN user_agent TEXT;
```
