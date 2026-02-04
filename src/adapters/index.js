// Session Adapters
export {
	SessionAdapter,
	DrizzleSessionAdapter,
	CookieSessionAdapter,
	D1SessionAdapter,
} from "./session/index.js";

// Database Adapters
export { DatabaseAdapter, DrizzleUserAdapter, D1UserAdapter } from "./database/index.js";

// Token Adapters (OAuth tokens)
export {
	TokenAdapter,
	DrizzleTokenAdapter,
	CookieTokenAdapter,
	D1TokenAdapter,
} from "./token/index.js";

// Verification Token Adapters (email verification, password reset, etc.)
export {
	VerificationTokenAdapter,
	DrizzleVerificationTokenAdapter,
	D1VerificationTokenAdapter,
} from "./tokens/index.js";

// Magic Link Adapters
export {
	MagicLinkAdapter,
	DrizzleMagicLinkAdapter,
	D1MagicLinkAdapter,
} from "./magic-link/index.js";

// WebAuthn Adapters
export {
	WebAuthnAdapter,
	DrizzleWebAuthnAdapter,
	D1WebAuthnAdapter,
} from "./webauthn/index.js";
