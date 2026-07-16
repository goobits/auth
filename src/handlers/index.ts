// OAuth handlers
export { createCallbackHandler } from './callback.ts'
export { createLoginHandler } from './login.ts'
export { createLogoutAction, createLogoutHandler } from './logout.ts'

// Credentials handlers
export {
	createPasswordResetConfirmHandler,
	createPasswordResetRequestHandler
} from './passwordReset.ts'
export {
	createSigninHandler,
	type SigninDeniedResult,
	type SigninHookContext,
	type SigninHookResult
} from './signin.ts'
export { createSignupHandler } from './signup.ts'

// MFA handlers
export {
	createMfaBackupCodeHandler,
	createMfaDisableHandler,
	createMfaEnrollHandler,
	createMfaLoginVerifyHandler,
	createMfaStatusHandler,
	createMfaStepUpHandler,
	createMfaVerifyHandler,
	beginMfaLoginChallenge,
	type MfaConfig,
	type MfaLoginConfig,
	type MfaStore
} from './mfa.ts'

// Magic link handlers
export { createMagicLinkRequestHandler, createMagicLinkVerifyHandler } from './magicLink.ts'

// WebAuthn handlers
export {
	createWebAuthnLoginOptionsHandler,
	createWebAuthnLoginVerifyHandler,
	createWebAuthnRegisterOptionsHandler,
	createWebAuthnRegisterVerifyHandler
} from './webauthn.ts'

// Session management handlers
export { createSessionListHandler, createSessionRevokeHandler } from './sessions.ts'
