// OAuth handlers
export { createLoginHandler } from "./login.js";
export { createCallbackHandler } from "./callback.js";
export { createLogoutHandler } from "./logout.js";

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
