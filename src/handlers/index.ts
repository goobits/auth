// OAuth handlers
export { createCallbackHandler } from './callback.ts'
export { createLoginHandler } from './login.ts'
export { createLogoutAction, createLogoutHandler } from './logout.ts'
export {
	createOAuthIdentityListHandler,
	createOAuthIdentityUnlinkHandler
} from './oauthIdentities.ts'

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
	createMfaStatusHandler,
	createMfaStepUpHandler,
	createMfaVerifyHandler
} from './mfaManagement.ts'
export {
	createMfaLoginVerifyHandler,
	beginMfaLoginChallenge,
	type MfaLoginChallengeResponse
} from './mfaLogin.ts'
export {
	type MfaConfig,
	type MfaLoginAttemptContext,
	type MfaLoginAttemptPolicy,
	type MfaLoginConfig,
	type MfaLoginDenial,
	type MfaStore
} from './_mfaTypes.ts'
export { consumeMfaCredentialProof } from './_mfaCredential.ts'

// Magic link handlers
export { createMagicLinkRequestHandler } from './magicLinkRequest.ts'
export { createMagicLinkVerifyHandler } from './magicLinkVerification.ts'

// WebAuthn handlers
export {
	createWebAuthnLoginOptionsHandler,
	createWebAuthnLoginVerifyHandler,
	createWebAuthnListCredentialsHandler,
	createWebAuthnRemoveCredentialHandler,
	createWebAuthnRegisterOptionsHandler,
	createWebAuthnRegisterVerifyHandler,
	createWebAuthnStepUpOptionsHandler,
	createWebAuthnStepUpVerifyHandler
} from '#webauthn-handlers'

// Session management handlers
export {
	createCurrentSessionHandler,
	createSessionListHandler,
	createSessionRevokeHandler
} from './sessions.ts'
export {
	type AssuredSessionAdapter,
	rotateSessionAssurance,
	type SessionAssuranceKind
} from './_assuredSession.ts'
