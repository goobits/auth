# Schema

## OAuth identities

```sql
CREATE TABLE oauth_accounts (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  PRIMARY KEY (provider, provider_account_id)
);

CREATE UNIQUE INDEX oauth_accounts_user_provider_idx
  ON oauth_accounts (user_id, provider);
```

`provider_account_id` stores the provider's stable subject, never an email or
display name. The second constraint prevents one local user from connecting two
subjects for the same provider. Keep both constraints race-safe in the database;
adapter preflight reads are only for clear errors and idempotency.

## Verification tokens

```sql
CREATE TABLE verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  metadata JSONB
);

CREATE UNIQUE INDEX verification_tokens_token_type_idx
  ON verification_tokens (token, type);
CREATE UNIQUE INDEX verification_tokens_user_type_idx
  ON verification_tokens (user_id, type);
CREATE INDEX verification_tokens_expires_idx
  ON verification_tokens (expires_at);
```

The PostgreSQL bundle creates the equivalent `auth_verification_tokens` table.
Tokens stored here are hashes; raw delivery values must never be persisted.
The `(user_id, type)` uniqueness constraint lets adapters replace an active
token atomically, so a failed replacement cannot delete the user's prior token.

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
  ADD COLUMN mfa_verified_at TIMESTAMP,
  ADD COLUMN ip TEXT,
  ADD COLUMN user_agent TEXT;
```

`mfa_verified_at` is required when privileged routes rely on recent MFA. The
Drizzle adapter reads the matching `mfaVerifiedAt` schema field, KV stores it in
the session record, and the PostgreSQL bundle creates and migrates
`auth_sessions.mfa_verified_at`. D1 keeps optional session columns disabled by
default for existing-schema compatibility; applications using assurance must
set `columns.mfaVerifiedAt` (and normally `columns.createdAt`) to their real SQL
column names.
