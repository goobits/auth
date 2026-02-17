import type {
	WebAuthnLoginOptionsHandlerConfig,
	WebAuthnLoginVerifyHandlerConfig,
	WebAuthnRegisterOptionsHandlerConfig,
	WebAuthnRegisterVerifyHandlerConfig,
} from "./webauthn.js";

function notSupported() {
	return new Response("WebAuthn is not supported on this runtime.", { status: 501 });
}

// Worker-safe stubs. Consumers should not enable WebAuthn on Cloudflare Workers.
export function createWebAuthnRegisterOptionsHandler(_config: WebAuthnRegisterOptionsHandlerConfig) {
	return async () => notSupported();
}

export function createWebAuthnRegisterVerifyHandler(_config: WebAuthnRegisterVerifyHandlerConfig) {
	return async () => notSupported();
}

export function createWebAuthnLoginOptionsHandler(_config: WebAuthnLoginOptionsHandlerConfig) {
	return async () => notSupported();
}

export function createWebAuthnLoginVerifyHandler(_config: WebAuthnLoginVerifyHandlerConfig) {
	return async () => notSupported();
}

