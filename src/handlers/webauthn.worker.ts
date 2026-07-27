import type {
	WebAuthnLoginOptionsHandlerConfig,
	WebAuthnLoginVerifyHandlerConfig,
	WebAuthnListCredentialsHandlerConfig,
	WebAuthnRemoveCredentialHandlerConfig,
	WebAuthnRegisterOptionsHandlerConfig,
	WebAuthnRegisterVerifyHandlerConfig,
	WebAuthnStepUpOptionsHandlerConfig,
	WebAuthnStepUpVerifyHandlerConfig
} from './webauthn.ts'

function notSupported() {
	return new Response('WebAuthn is not supported on this runtime.', { status: 501 })
}

// Worker-safe stubs. Consumers should not enable WebAuthn on Cloudflare Workers.
export function createWebAuthnRegisterOptionsHandler(
	_config: WebAuthnRegisterOptionsHandlerConfig
) {
	return async () => notSupported()
}

export function createWebAuthnRegisterVerifyHandler(_config: WebAuthnRegisterVerifyHandlerConfig) {
	return async () => notSupported()
}

export function createWebAuthnLoginOptionsHandler(_config: WebAuthnLoginOptionsHandlerConfig) {
	return async () => notSupported()
}

export function createWebAuthnLoginVerifyHandler(_config: WebAuthnLoginVerifyHandlerConfig) {
	return async () => notSupported()
}

export function createWebAuthnListCredentialsHandler(
	_config: WebAuthnListCredentialsHandlerConfig
) {
	return async () => notSupported()
}

export function createWebAuthnRemoveCredentialHandler(
	_config: WebAuthnRemoveCredentialHandlerConfig
) {
	return async () => notSupported()
}

export function createWebAuthnStepUpOptionsHandler(_config: WebAuthnStepUpOptionsHandlerConfig) {
	return async () => notSupported()
}

export function createWebAuthnStepUpVerifyHandler(_config: WebAuthnStepUpVerifyHandlerConfig) {
	return async () => notSupported()
}
