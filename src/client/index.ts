type Base64Input =
	| ArrayBuffer
	| ArrayBufferView
	| Uint8Array
	| string
	| null
	| undefined;

type PasskeyEndpoints = {
	magicLinkRequest?: string;
	magicLinkVerify?: string;
	passkeyRegisterOptions?: string;
	passkeyRegisterVerify?: string;
	passkeyLoginOptions?: string;
	passkeyLoginVerify?: string;
	mfaStatus?: string;
	mfaEnroll?: string;
	mfaVerify?: string;
	mfaDisable?: string;
	mfaBackupCode?: string;
	sessions?: string;
};

type CreateAuthClientOptions = {
	baseUrl?: string;
	endpoints?: PasskeyEndpoints;
	fetcher?: typeof fetch;
};

function decodeBase64url(value: string): Uint8Array {
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
	const binary = globalThis.atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

function encodeBase64url(value: Uint8Array): string {
	let binary = "";
	for (const byte of value) {
		binary += String.fromCharCode(byte);
	}
	return globalThis
		.btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function toUint8Array(value: Base64Input): Uint8Array {
	if (!value) return new Uint8Array();
	if (value instanceof Uint8Array) return value;
	if (value instanceof ArrayBuffer) return new Uint8Array(value);
	if (ArrayBuffer.isView(value)) {
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
	}
	if (typeof value === "string") return decodeBase64url(value);
	return new Uint8Array(value);
}

function toBase64url(value: Base64Input): string {
	return encodeBase64url(toUint8Array(value));
}

function parseCreationOptions(options: Record<string, unknown>): PublicKeyCredentialCreationOptions {
	const parsed = { ...options } as Record<string, unknown>;
	parsed["challenge"] = toUint8Array((options as { challenge?: Base64Input })["challenge"]);
	const user = (options as { user?: { id?: Base64Input } }).user;
	if (user?.id) {
		parsed["user"] = { ...user, id: toUint8Array(user.id) };
	}
	const exclude = (options as { excludeCredentials?: Array<{ id?: Base64Input }> })
		.excludeCredentials;
	if (Array.isArray(exclude)) {
		parsed["excludeCredentials"] = exclude.map((cred) => ({
			...cred,
			id: toUint8Array(cred.id),
		}));
	}
	return parsed as unknown as PublicKeyCredentialCreationOptions;
}

function parseRequestOptions(options: Record<string, unknown>): PublicKeyCredentialRequestOptions {
	const parsed = { ...options } as Record<string, unknown>;
	parsed["challenge"] = toUint8Array((options as { challenge?: Base64Input })["challenge"]);
	const allow = (options as { allowCredentials?: Array<{ id?: Base64Input }> })
		.allowCredentials;
	if (Array.isArray(allow)) {
		parsed["allowCredentials"] = allow.map((cred) => ({
			...cred,
			id: toUint8Array(cred.id),
		}));
	}
	return parsed as unknown as PublicKeyCredentialRequestOptions;
}

function serializeCredential(credential: unknown) {
	if (!credential) return null;
	const response = (credential as { response?: Record<string, unknown> }).response || {};
	return {
		id: (credential as { id?: string }).id,
		type: (credential as { type?: string }).type,
		rawId: toBase64url((credential as { rawId?: Base64Input }).rawId),
		response: {
			attestationObject: response["attestationObject"]
				? toBase64url(response["attestationObject"] as Base64Input)
				: undefined,
			clientDataJSON: response["clientDataJSON"]
				? toBase64url(response["clientDataJSON"] as Base64Input)
				: undefined,
			authenticatorData: response["authenticatorData"]
				? toBase64url(response["authenticatorData"] as Base64Input)
				: undefined,
			signature: response["signature"]
				? toBase64url(response["signature"] as Base64Input)
				: undefined,
			userHandle: response["userHandle"]
				? toBase64url(response["userHandle"] as Base64Input)
				: undefined,
			transports: response["getTransports"]
				? (response["getTransports"] as () => string[])()
				: undefined,
		},
	};
}

export function createAuthClient({
	baseUrl = "",
	endpoints = {},
	fetcher = fetch,
}: CreateAuthClientOptions = {}) {
	const resolved = {
		magicLinkRequest: endpoints.magicLinkRequest || "/auth/magic",
		magicLinkVerify: endpoints.magicLinkVerify || "/auth/magic/verify",
		passkeyRegisterOptions:
			endpoints.passkeyRegisterOptions || "/auth/passkey/register/options",
		passkeyRegisterVerify:
			endpoints.passkeyRegisterVerify || "/auth/passkey/register/verify",
		passkeyLoginOptions:
			endpoints.passkeyLoginOptions || "/auth/passkey/login/options",
		passkeyLoginVerify:
			endpoints.passkeyLoginVerify || "/auth/passkey/login/verify",
		mfaStatus: endpoints.mfaStatus || "/auth/mfa/status",
		mfaEnroll: endpoints.mfaEnroll || "/auth/mfa/enroll",
		mfaVerify: endpoints.mfaVerify || "/auth/mfa/verify",
		mfaDisable: endpoints.mfaDisable || "/auth/mfa/disable",
		mfaBackupCode: endpoints.mfaBackupCode || "/auth/mfa/backup-code",
		sessions: endpoints.sessions || "/auth/sessions",
	};

	const jsonHeaders = { "content-type": "application/json" };
	const withBase = (path: string) => `${baseUrl}${path}`;

	return {
		loginWithOAuth(provider: string) {
			if (!provider) throw new Error("Provider is required");
			const url = `${baseUrl}/auth/${provider}`;
			if (typeof window !== "undefined") {
				window.location.assign(url);
			}
			return url;
		},

		async sendMagicLink({
			email,
			redirectTo,
		}: { email?: string; redirectTo?: string } = {}) {
			const response = await fetcher(withBase(resolved.magicLinkRequest), {
				method: "POST",
				headers: jsonHeaders,
				body: JSON.stringify({ email, redirectTo }),
			});
			return response.json();
		},

		async verifyMagicLink({
			token,
			otp,
			email,
		}: { token?: string; otp?: string; email?: string } = {}) {
			const response = await fetcher(withBase(resolved.magicLinkVerify), {
				method: "POST",
				headers: jsonHeaders,
				body: JSON.stringify({ token, otp, email }),
			});
			return response.json();
		},

		async registerPasskey({ name }: { name?: string } = {}) {
			if (!globalThis?.navigator?.credentials) {
				throw new Error("WebAuthn not supported in this environment");
			}
			const optionsRes = await fetcher(
				withBase(resolved.passkeyRegisterOptions),
				{ method: "POST" },
			);
			const { options, challengeId } = await optionsRes.json();
			const credential = await navigator.credentials.create({
				publicKey: parseCreationOptions(options),
			});
			const verifyRes = await fetcher(
				withBase(resolved.passkeyRegisterVerify),
				{
					method: "POST",
					headers: jsonHeaders,
					body: JSON.stringify({
						challengeId,
						credential: serializeCredential(credential),
						name,
					}),
				},
			);
			return verifyRes.json();
		},

		async loginWithPasskey({ email }: { email?: string } = {}) {
			if (!globalThis?.navigator?.credentials) {
				throw new Error("WebAuthn not supported in this environment");
			}
			const optionsRes = await fetcher(
				withBase(resolved.passkeyLoginOptions),
				{
					method: "POST",
					headers: jsonHeaders,
					body: JSON.stringify({ email }),
				},
			);
			const { options, challengeId } = await optionsRes.json();
			const credential = await navigator.credentials.get({
				publicKey: parseRequestOptions(options),
			});
			const verifyRes = await fetcher(
				withBase(resolved.passkeyLoginVerify),
				{
					method: "POST",
					headers: jsonHeaders,
					body: JSON.stringify({
						challengeId,
						credential: serializeCredential(credential),
					}),
				},
			);
			return verifyRes.json();
		},

		async getMfaStatus() {
			const response = await fetcher(withBase(resolved.mfaStatus), {
				method: "GET",
			});
			return response.json();
		},

		async enrollMfa() {
			const response = await fetcher(withBase(resolved.mfaEnroll), {
				method: "POST",
			});
			return response.json();
		},

		async verifyMfa({ token }: { token: string }) {
			const form = new FormData();
			form.set("token", token);
			const response = await fetcher(withBase(resolved.mfaVerify), {
				method: "POST",
				body: form,
			});
			return response.json();
		},

		async disableMfa() {
			const response = await fetcher(withBase(resolved.mfaDisable), {
				method: "POST",
			});
			return response.json();
		},

		async useMfaBackupCode({ code }: { code: string }) {
			const form = new FormData();
			form.set("code", code);
			const response = await fetcher(withBase(resolved.mfaBackupCode), {
				method: "POST",
				body: form,
			});
			return response.json();
		},

		async listSessions() {
			const response = await fetcher(withBase(resolved.sessions), {
				method: "GET",
			});
			return response.json();
		},

		async revokeSession({
			sessionId,
			all,
			others,
		}: { sessionId?: string; all?: boolean; others?: boolean } = {}) {
			const response = await fetcher(withBase(resolved.sessions), {
				method: "POST",
				headers: jsonHeaders,
				body: JSON.stringify({ sessionId, all, others }),
			});
			return response.json();
		},
	};
}
