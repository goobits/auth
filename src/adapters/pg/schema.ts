/** Pg Auth Schema Sql registry entry for runtime integration. */
export const pgAuthSchemaSql = `
CREATE TABLE IF NOT EXISTS auth_users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	avatar TEXT,
	email_verified BOOLEAN NOT NULL DEFAULT FALSE,
	role TEXT,
	settings JSONB NOT NULL DEFAULT '{}'::jsonb,
	password TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_oauth_accounts (
	provider TEXT NOT NULL,
	provider_account_id TEXT NOT NULL,
	user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS auth_oauth_accounts_user_id_idx ON auth_oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	last_active_at TIMESTAMPTZ,
	ip TEXT,
	user_agent TEXT,
	fingerprint TEXT,
	mfa_verified_at TIMESTAMPTZ
);

ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_verification_tokens (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
	type TEXT NOT NULL,
	token TEXT NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_verification_tokens_token_type_idx
	ON auth_verification_tokens(token, type);
CREATE UNIQUE INDEX IF NOT EXISTS auth_verification_tokens_user_type_idx
	ON auth_verification_tokens(user_id, type);
CREATE INDEX IF NOT EXISTS auth_verification_tokens_expires_at_idx
	ON auth_verification_tokens(expires_at);

CREATE TABLE IF NOT EXISTS auth_mfa_factors (
	user_id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
	secret TEXT NOT NULL,
	enabled_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_mfa_backup_codes (
	user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
	code_hash TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, code_hash)
);

CREATE TABLE IF NOT EXISTS auth_webauthn_challenges (
	id TEXT PRIMARY KEY,
	user_id TEXT REFERENCES auth_users(id) ON DELETE CASCADE,
	challenge TEXT NOT NULL,
	type TEXT NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_webauthn_challenges_expires_at_idx ON auth_webauthn_challenges(expires_at);
CREATE INDEX IF NOT EXISTS auth_webauthn_challenges_user_id_idx ON auth_webauthn_challenges(user_id);

CREATE TABLE IF NOT EXISTS auth_webauthn_credentials (
	credential_id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
	public_key TEXT NOT NULL,
	counter INTEGER NOT NULL DEFAULT 0,
	transports JSONB,
	name TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_webauthn_credentials_user_id_idx ON auth_webauthn_credentials(user_id);

CREATE TABLE IF NOT EXISTS auth_magic_link_tokens (
	id TEXT PRIMARY KEY,
	user_id TEXT REFERENCES auth_users(id) ON DELETE CASCADE,
	email TEXT NOT NULL,
	token_hash TEXT NOT NULL,
	otp_hash TEXT,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS auth_magic_link_tokens_email_idx ON auth_magic_link_tokens(email);
CREATE INDEX IF NOT EXISTS auth_magic_link_tokens_token_hash_idx ON auth_magic_link_tokens(token_hash);
CREATE INDEX IF NOT EXISTS auth_magic_link_tokens_otp_hash_idx ON auth_magic_link_tokens(otp_hash);
CREATE INDEX IF NOT EXISTS auth_magic_link_tokens_expires_at_idx ON auth_magic_link_tokens(expires_at);
`
