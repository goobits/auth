// OAuth handlers
export { createCallbackHandler } from './callback.js'
export { createLoginHandler } from './login.js'
export { createLogoutAction, createLogoutHandler } from './logout.js'

// Credentials handlers
export {
	createPasswordResetConfirmHandler,
	createPasswordResetRequestHandler
} from './passwordReset.js'
export { createSigninHandler } from './signin.js'
export { createSignupHandler } from './signup.js'

// MFA handlers
export {
	createMfaBackupCodeHandler,
	createMfaDisableHandler,
	createMfaEnrollHandler,
	createMfaStatusHandler,
	createMfaVerifyHandler,
	type MfaConfig,
	type MfaStore
} from './mfa.js'

// Magic link handlers
export {
	createMagicLinkRequestHandler,
	createMagicLinkVerifyHandler
} from './magicLink.js'

// WebAuthn handlers
export {
	createWebAuthnLoginOptionsHandler,
	createWebAuthnLoginVerifyHandler,
	createWebAuthnRegisterOptionsHandler,
	createWebAuthnRegisterVerifyHandler
} from './webauthn.js'

// Session management handlers
export { createSessionListHandler, createSessionRevokeHandler } from './sessions.js'
