// Session Adapters
export {
	CookieSessionAdapter,
	D1SessionAdapter,
	DrizzleSessionAdapter,
	SessionAdapter
} from './session/index.js'

// Database Adapters
export { D1UserAdapter, DrizzleUserAdapter, UserAdapter } from './database/index.js'

// Token Adapters (OAuth tokens)
export {
	CookieTokenAdapter,
	D1TokenAdapter,
	DrizzleTokenAdapter,
	TokenAdapter
} from './oauth-token/index.js'

// Verification Token Adapters (email verification, password reset, etc.)
export {
	D1VerificationTokenAdapter,
	DrizzleVerificationTokenAdapter,
	VerificationTokenAdapter
} from './verification-token/index.js'

// Magic Link Adapters
export {
	D1MagicLinkAdapter,
	DrizzleMagicLinkAdapter,
	MagicLinkAdapter
} from './magic-link/index.js'

// WebAuthn Adapters
export {
	D1WebAuthnAdapter,
	DrizzleWebAuthnAdapter,
	WebAuthnAdapter
} from './webauthn/index.js'

// One-stop Drizzle adapter bundle
export type {
	DrizzleAdapterBundle,
	DrizzleAdapterOptions,
	DrizzleAuthSchema
} from './drizzle/index.js'
export { drizzleAdapter } from './drizzle/index.js'

// Runtime adapter bundles
export { createMemoryAuthAdapters, MemorySessionAdapter, MemoryUserAdapter } from './memory/index.js'
