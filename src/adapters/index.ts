// Session Adapters
export { D1SessionAdapter, DrizzleSessionAdapter, SessionAdapter } from './session/index.ts'

// Database Adapters
export {
	type PasswordCredential,
	type PasswordCredentialAdapter,
	type UserAdapterBundle,
	assertPublicUserData,
	D1UserAdapter,
	DrizzleUserAdapter,
	omitSensitiveUserData,
	UserAdapter
} from './database/index.ts'

// Token Adapters (OAuth tokens)
export {
	type AesGcmOAuthTokenCodecOptions,
	type OAuthTokenCipherContext,
	type OAuthTokenCodec,
	type OAuthTokenEncryptionOptions,
	type OpenedOAuthTokenPayload,
	CookieTokenAdapter,
	createAesGcmOAuthTokenCodec,
	D1TokenAdapter,
	DrizzleTokenAdapter,
	TokenAdapter
} from './oauth-token/index.ts'

// Verification Token Adapters (email verification, password reset, etc.)
export {
	D1VerificationTokenAdapter,
	DrizzleVerificationTokenAdapter,
	VerificationTokenAdapter
} from './verification-token/index.ts'
export type { VerificationTokenRecord } from './verification-token/index.ts'

// Magic Link Adapters
export {
	D1MagicLinkAdapter,
	DrizzleMagicLinkAdapter,
	MagicLinkAdapter
} from './magic-link/index.ts'

// MFA Adapters
export {
	createAesGcmMfaSecretCodec,
	D1MfaAdapter,
	MfaAdapter,
	type MfaSecretCodec
} from './mfa/index.ts'

// WebAuthn Adapters
export { D1WebAuthnAdapter, DrizzleWebAuthnAdapter, WebAuthnAdapter } from './webauthn/index.ts'

// One-stop Drizzle adapter bundle
export type {
	DrizzleAdapterBundle,
	DrizzleAdapterOptions,
	DrizzleAuthSchema
} from './drizzle/index.ts'
export { drizzleAdapter } from './drizzle/index.ts'

// Type-only export keeps the aggregate adapter entrypoint Worker-safe.
export type { PgPoolLike } from './pg/index.ts'
