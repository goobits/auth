// OAuth handlers
export { createLoginHandler } from "./login.ts";
export { createCallbackHandler } from "./callback.ts";
export { createLogoutHandler } from "./logout.ts";

// Credentials handlers
export { createSignupHandler } from "./signup.ts";
export { createSigninHandler } from "./signin.ts";
export {
	createPasswordResetRequestHandler,
	createPasswordResetConfirmHandler,
} from "./password-reset.ts";

// MFA handlers
export {
	createMfaEnrollHandler,
	createMfaVerifyHandler,
	createMfaDisableHandler,
	createMfaBackupCodeHandler,
} from "./mfa.ts";

// Magic link handlers
export {
	createMagicLinkRequestHandler,
	createMagicLinkVerifyHandler,
} from "./magic-link.ts";

// WebAuthn handlers
export {
	createWebAuthnRegisterOptionsHandler,
	createWebAuthnRegisterVerifyHandler,
	createWebAuthnLoginOptionsHandler,
	createWebAuthnLoginVerifyHandler,
} from "./webauthn.ts";

// Session management handlers
export { createSessionListHandler, createSessionRevokeHandler } from "./sessions.ts";
