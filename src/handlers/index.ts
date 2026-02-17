// OAuth handlers
export { createLoginHandler } from "./login.js";
export { createCallbackHandler } from "./callback.js";
export { createLogoutHandler, createLogoutAction } from "./logout.js";

// Credentials handlers
export { createSignupHandler } from "./signup.js";
export { createSigninHandler } from "./signin.js";
export {
	createPasswordResetRequestHandler,
	createPasswordResetConfirmHandler,
} from "./password-reset.js";

// MFA handlers
export {
	createMfaEnrollHandler,
	createMfaVerifyHandler,
	createMfaDisableHandler,
	createMfaBackupCodeHandler,
} from "./mfa.js";

// Magic link handlers
export {
	createMagicLinkRequestHandler,
	createMagicLinkVerifyHandler,
} from "./magic-link.js";

// WebAuthn handlers
export {
	createWebAuthnRegisterOptionsHandler,
	createWebAuthnRegisterVerifyHandler,
	createWebAuthnLoginOptionsHandler,
	createWebAuthnLoginVerifyHandler,
} from "./webauthn.js";

// Session management handlers
export { createSessionListHandler, createSessionRevokeHandler } from "./sessions.js";
