// Session Adapters
export {
	SessionAdapter,
	DrizzleSessionAdapter,
	CookieSessionAdapter,
	D1SessionAdapter,
} from "./session/index.ts";

// Database Adapters
export { UserAdapter, DrizzleUserAdapter, D1UserAdapter } from "./database/index.ts";

// Token Adapters (OAuth tokens)
export {
	TokenAdapter,
	DrizzleTokenAdapter,
	CookieTokenAdapter,
	D1TokenAdapter,
} from "./oauth-token/index.ts";

// Verification Token Adapters (email verification, password reset, etc.)
export {
	VerificationTokenAdapter,
	DrizzleVerificationTokenAdapter,
	D1VerificationTokenAdapter,
} from "./verification-token/index.ts";

// Magic Link Adapters
export {
	MagicLinkAdapter,
	DrizzleMagicLinkAdapter,
	D1MagicLinkAdapter,
} from "./magic-link/index.ts";

// WebAuthn Adapters
export {
	WebAuthnAdapter,
	DrizzleWebAuthnAdapter,
	D1WebAuthnAdapter,
} from "./webauthn/index.ts";
