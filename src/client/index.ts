import { createCsrfFetch, type CsrfFetchConfig } from '@goobits/security/csrf-client'
import { base64UrlToBytes, bytesToBase64Url } from '@goobits/security/crypto/encoding'

import { AUTH_ROUTE_PATHS, resolveAuthRoutePath } from '../_routePaths.ts'

type Base64Input = ArrayBuffer | ArrayBufferView | Uint8Array | string | null | undefined

export type AuthClientEndpoints = {
	magicLinkRequest?: string
	magicLinkVerify?: string
	passkeyRegisterOptions?: string
	passkeyRegisterVerify?: string
	passkeyLoginOptions?: string
	passkeyLoginVerify?: string
	passkeyCredentials?: string
	passkeyStepUpOptions?: string
	passkeyStepUpVerify?: string
	mfaStatus?: string
	mfaEnroll?: string
	mfaVerify?: string
	mfaDisable?: string
	mfaBackupCode?: string
	mfaStepUp?: string
	sessions?: string
	sessionRevoke?: string
}

export type CreateAuthClientOptions = {
	baseUrl?: string
	csrf?: Omit<CsrfFetchConfig, 'fetch'>
	endpoints?: AuthClientEndpoints
	fetcher?: typeof fetch
	headers?: HeadersInit
}

export type AuthClientFailure = {
	success: false
	error: string
	code?: string
	status?: number
}

export type MfaEnrollmentResult =
	| AuthClientFailure
	| {
			success: true
			secret: string
			otpauthUrl: string
			backupCodes: string[]
	  }

export type MfaActionResult = AuthClientFailure | { success: true; mfaVerifiedAt?: string }

export type MfaStatusResult =
	| AuthClientFailure
	| {
			success: true
			status: {
				enabled: boolean
				enabledAt: string | null
				backupCodeCount: number
			}
	  }

export type PasskeyCredentialSummary = {
	credentialId: string
	name: string | null
	transports: string[] | null
	createdAt: string | null
	lastUsedAt: string | null
}

export type PasskeyListResult =
	| AuthClientFailure
	| { success: true; credentials: PasskeyCredentialSummary[] }

/** Returns whether the current browser exposes the WebAuthn credential API. */
export function supportsPasskeys(): boolean {
	return (
		typeof globalThis.PublicKeyCredential !== 'undefined' &&
		Boolean(globalThis.navigator?.credentials)
	)
}

type PasskeyOptionsResult =
	| AuthClientFailure
	| {
			success: true
			options: Record<string, unknown>
			challengeId: string
	  }

export type AuthSessionSummary = {
	id: string
	userId: string
	expiresAt: string
	createdAt: string | null
	lastActiveAt: string | null
	ip: string | null
	userAgent: string | null
	current: boolean
}

export type SessionListResult =
	| { ok: false; error: string }
	| { ok: true; sessions: AuthSessionSummary[] }

export type SessionActionResult = { ok: false; error: string } | { ok: true }

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJsonRecord(response: Response): Promise<Record<string, unknown>> {
	const value: unknown = await response.json()
	if (!isRecord(value)) throw new Error('Invalid authentication response')
	return value
}

function parseFailure(value: Record<string, unknown>): AuthClientFailure {
	const result: AuthClientFailure = {
		success: false,
		error: typeof value['error'] === 'string' ? value['error'] : 'Authentication request failed'
	}
	if (typeof value['code'] === 'string') result.code = value['code']
	if (typeof value['status'] === 'number') result.status = value['status']
	return result
}

function requireSuccessFlag(value: Record<string, unknown>): boolean {
	if (typeof value['success'] !== 'boolean') throw new Error('Invalid authentication response')
	return value['success']
}

function parseMfaAction(value: Record<string, unknown>): MfaActionResult {
	if (!requireSuccessFlag(value)) return parseFailure(value)
	const verifiedAt = value['mfaVerifiedAt']
	if (verifiedAt !== undefined && typeof verifiedAt !== 'string') {
		throw new Error('Invalid authentication response')
	}
	return verifiedAt ? { success: true, mfaVerifiedAt: verifiedAt } : { success: true }
}

function parsePasskeyCredential(value: unknown): PasskeyCredentialSummary {
	if (!isRecord(value)) throw new Error('Invalid authentication response')
	const credentialId = value['credentialId']
	const name = value['name']
	const transports = value['transports']
	const createdAt = value['createdAt']
	const lastUsedAt = value['lastUsedAt']
	if (
		typeof credentialId !== 'string' ||
		(name !== null && typeof name !== 'string') ||
		(transports !== null &&
			(!Array.isArray(transports) ||
				!transports.every((transport) => typeof transport === 'string'))) ||
		(createdAt !== null && typeof createdAt !== 'string') ||
		(lastUsedAt !== null && typeof lastUsedAt !== 'string')
	) {
		throw new Error('Invalid authentication response')
	}
	return { credentialId, name, transports, createdAt, lastUsedAt }
}

function parsePasskeyAction(value: Record<string, unknown>): MfaActionResult {
	if (value['ok'] === false) {
		return {
			success: false,
			error: typeof value['error'] === 'string' ? value['error'] : 'Authentication request failed'
		}
	}
	if (value['ok'] !== true) throw new Error('Invalid authentication response')
	const verifiedAt = value['mfaVerifiedAt']
	if (verifiedAt !== undefined && typeof verifiedAt !== 'string') {
		throw new Error('Invalid authentication response')
	}
	return verifiedAt ? { success: true, mfaVerifiedAt: verifiedAt } : { success: true }
}

function parsePasskeyOptions(value: Record<string, unknown>): PasskeyOptionsResult {
	if (value['ok'] === false || value['success'] === false) return parseFailure(value)
	if (!isRecord(value['options']) || typeof value['challengeId'] !== 'string') {
		throw new Error('Invalid authentication response')
	}
	return {
		success: true,
		options: value['options'],
		challengeId: value['challengeId']
	}
}

function parseSessionFailure(value: Record<string, unknown>): { ok: false; error: string } {
	return {
		ok: false,
		error: typeof value['error'] === 'string' ? value['error'] : 'Session request failed'
	}
}

function parseSessionSummary(value: unknown): AuthSessionSummary {
	if (!isRecord(value)) throw new Error('Invalid authentication response')
	const id = value['id']
	const userId = value['userId']
	const expiresAt = value['expiresAt']
	const createdAt = value['createdAt']
	const lastActiveAt = value['lastActiveAt']
	const ip = value['ip']
	const userAgent = value['userAgent']
	const current = value['current']
	if (
		typeof id !== 'string' ||
		typeof userId !== 'string' ||
		typeof expiresAt !== 'string' ||
		(createdAt !== null && typeof createdAt !== 'string') ||
		(lastActiveAt !== null && typeof lastActiveAt !== 'string') ||
		(ip !== null && typeof ip !== 'string') ||
		(userAgent !== null && typeof userAgent !== 'string') ||
		typeof current !== 'boolean'
	) {
		throw new Error('Invalid authentication response')
	}
	return {
		id,
		userId,
		expiresAt,
		createdAt,
		lastActiveAt,
		ip,
		userAgent,
		current
	}
}

function mergeHeaders(
	defaults: HeadersInit | undefined,
	overrides: HeadersInit | undefined
): Headers {
	const headers = new Headers(defaults)
	for (const [name, value] of new Headers(overrides)) headers.set(name, value)
	return headers
}

function toUint8Array(value: Base64Input): Uint8Array {
	if (!value) return new Uint8Array()
	if (value instanceof Uint8Array) return value
	if (value instanceof ArrayBuffer) return new Uint8Array(value)
	if (ArrayBuffer.isView(value)) {
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
	}
	if (typeof value === 'string') return base64UrlToBytes(value)
	return new Uint8Array(value)
}

function toBase64url(value: Base64Input): string {
	return bytesToBase64Url(toUint8Array(value))
}

function parseCreationOptions(
	options: Record<string, unknown>
): PublicKeyCredentialCreationOptions {
	const parsed = { ...options } as Record<string, unknown>
	parsed['challenge'] = toUint8Array((options as { challenge?: Base64Input })['challenge'])
	const user = (options as { user?: { id?: Base64Input } }).user
	if (user?.id) {
		parsed['user'] = { ...user, id: toUint8Array(user.id) }
	}
	const exclude = (options as { excludeCredentials?: Array<{ id?: Base64Input }> })
		.excludeCredentials
	if (Array.isArray(exclude)) {
		parsed['excludeCredentials'] = exclude.map((cred) => ({
			...cred,
			id: toUint8Array(cred.id)
		}))
	}
	return parsed as unknown as PublicKeyCredentialCreationOptions
}

function parseRequestOptions(options: Record<string, unknown>): PublicKeyCredentialRequestOptions {
	const parsed = { ...options } as Record<string, unknown>
	parsed['challenge'] = toUint8Array((options as { challenge?: Base64Input })['challenge'])
	const allow = (options as { allowCredentials?: Array<{ id?: Base64Input }> }).allowCredentials
	if (Array.isArray(allow)) {
		parsed['allowCredentials'] = allow.map((cred) => ({
			...cred,
			id: toUint8Array(cred.id)
		}))
	}
	return parsed as unknown as PublicKeyCredentialRequestOptions
}

function serializeCredential(credential: unknown) {
	if (!credential) return null
	const response = (credential as { response?: Record<string, unknown> }).response || {}
	return {
		id: (credential as { id?: string }).id,
		type: (credential as { type?: string }).type,
		rawId: toBase64url((credential as { rawId?: Base64Input }).rawId),
		response: {
			attestationObject: response['attestationObject']
				? toBase64url(response['attestationObject'] as Base64Input)
				: undefined,
			clientDataJSON: response['clientDataJSON']
				? toBase64url(response['clientDataJSON'] as Base64Input)
				: undefined,
			authenticatorData: response['authenticatorData']
				? toBase64url(response['authenticatorData'] as Base64Input)
				: undefined,
			signature: response['signature']
				? toBase64url(response['signature'] as Base64Input)
				: undefined,
			userHandle: response['userHandle']
				? toBase64url(response['userHandle'] as Base64Input)
				: undefined,
			transports: response['getTransports']
				? (response['getTransports'] as () => string[])()
				: undefined
		}
	}
}

/** Creates auth client for auth runtime. */
export function createAuthClient({
	baseUrl = '',
	csrf = {},
	endpoints = {},
	fetcher = fetch,
	headers
}: CreateAuthClientOptions = {}) {
	const defaultEndpoint = (path: string) => resolveAuthRoutePath('/auth', path)
	const resolved = {
		magicLinkRequest: endpoints.magicLinkRequest || defaultEndpoint(AUTH_ROUTE_PATHS.magicLink),
		magicLinkVerify: endpoints.magicLinkVerify || defaultEndpoint(AUTH_ROUTE_PATHS.magicLinkVerify),
		passkeyRegisterOptions:
			endpoints.passkeyRegisterOptions || defaultEndpoint(AUTH_ROUTE_PATHS.passkeyRegisterOptions),
		passkeyRegisterVerify:
			endpoints.passkeyRegisterVerify || defaultEndpoint(AUTH_ROUTE_PATHS.passkeyRegisterVerify),
		passkeyLoginOptions:
			endpoints.passkeyLoginOptions || defaultEndpoint(AUTH_ROUTE_PATHS.passkeyLoginOptions),
		passkeyLoginVerify:
			endpoints.passkeyLoginVerify || defaultEndpoint(AUTH_ROUTE_PATHS.passkeyLoginVerify),
		passkeyCredentials:
			endpoints.passkeyCredentials || defaultEndpoint(AUTH_ROUTE_PATHS.passkeyCredentials),
		passkeyStepUpOptions:
			endpoints.passkeyStepUpOptions || defaultEndpoint(AUTH_ROUTE_PATHS.passkeyStepUpOptions),
		passkeyStepUpVerify:
			endpoints.passkeyStepUpVerify || defaultEndpoint(AUTH_ROUTE_PATHS.passkeyStepUpVerify),
		mfaStatus: endpoints.mfaStatus || defaultEndpoint(AUTH_ROUTE_PATHS.mfaStatus),
		mfaEnroll: endpoints.mfaEnroll || defaultEndpoint(AUTH_ROUTE_PATHS.mfaEnroll),
		mfaVerify: endpoints.mfaVerify || defaultEndpoint(AUTH_ROUTE_PATHS.mfaVerify),
		mfaDisable: endpoints.mfaDisable || defaultEndpoint(AUTH_ROUTE_PATHS.mfaDisable),
		mfaBackupCode: endpoints.mfaBackupCode || defaultEndpoint(AUTH_ROUTE_PATHS.mfaBackupCode),
		mfaStepUp: endpoints.mfaStepUp || defaultEndpoint(AUTH_ROUTE_PATHS.mfaStepUp),
		sessions: endpoints.sessions || defaultEndpoint(AUTH_ROUTE_PATHS.sessions),
		sessionRevoke:
			endpoints.sessionRevoke || endpoints.sessions || defaultEndpoint(AUTH_ROUTE_PATHS.sessions)
	}

	const jsonHeaders = { 'content-type': 'application/json' }
	const withBase = (path: string) => `${baseUrl}${path}`
	const configuredFetcher: typeof fetch = (input, init = {}) =>
		fetcher(input, { ...init, headers: mergeHeaders(headers, init.headers) })
	const authFetch = createCsrfFetch({
		...csrf,
		fetch: configuredFetcher
	})

	return {
		loginWithOAuth(provider: string) {
			if (!provider) throw new Error('Provider is required')
			const url = `${baseUrl}/auth/${provider}`
			if (typeof window !== 'undefined') {
				window.location.assign(url)
			}
			return url
		},

		async sendMagicLink({ email, redirectTo }: { email?: string; redirectTo?: string } = {}) {
			const response = await authFetch(withBase(resolved.magicLinkRequest), {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({ email, redirectTo })
			})
			return response.json()
		},

		async verifyMagicLink({
			token,
			otp,
			email
		}: { token?: string; otp?: string; email?: string } = {}) {
			const response = await authFetch(withBase(resolved.magicLinkVerify), {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({ token, otp, email })
			})
			return response.json()
		},

		async registerPasskey({
			name,
			currentPassword
		}: { name?: string; currentPassword?: string } = {}) {
			if (!supportsPasskeys()) {
				throw new Error('WebAuthn not supported in this environment')
			}
			const authorization = new FormData()
			if (currentPassword) authorization.set('currentPassword', currentPassword)
			const optionsRes = await authFetch(withBase(resolved.passkeyRegisterOptions), {
				method: 'POST',
				body: authorization
			})
			const optionsResult = parsePasskeyOptions(await readJsonRecord(optionsRes))
			if (!optionsResult.success) return optionsResult
			const credential = await navigator.credentials.create({
				publicKey: parseCreationOptions(optionsResult.options)
			})
			const verifyRes = await authFetch(withBase(resolved.passkeyRegisterVerify), {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					challengeId: optionsResult.challengeId,
					credential: serializeCredential(credential),
					name
				})
			})
			return parsePasskeyAction(await readJsonRecord(verifyRes))
		},

		async loginWithPasskey() {
			if (!supportsPasskeys()) {
				throw new Error('WebAuthn not supported in this environment')
			}
			const optionsRes = await authFetch(withBase(resolved.passkeyLoginOptions), {
				method: 'POST'
			})
			const optionsResult = parsePasskeyOptions(await readJsonRecord(optionsRes))
			if (!optionsResult.success) return optionsResult
			const credential = await navigator.credentials.get({
				publicKey: parseRequestOptions(optionsResult.options)
			})
			const verifyRes = await authFetch(withBase(resolved.passkeyLoginVerify), {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					challengeId: optionsResult.challengeId,
					credential: serializeCredential(credential)
				})
			})
			return parsePasskeyAction(await readJsonRecord(verifyRes))
		},

		async listPasskeys(): Promise<PasskeyListResult> {
			const value = await readJsonRecord(
				await authFetch(withBase(resolved.passkeyCredentials), { method: 'GET' })
			)
			if (value['ok'] === false) {
				return {
					success: false,
					error:
						typeof value['error'] === 'string' ? value['error'] : 'Authentication request failed'
				}
			}
			if (value['ok'] !== true || !Array.isArray(value['credentials'])) {
				throw new Error('Invalid authentication response')
			}
			return {
				success: true,
				credentials: value['credentials'].map(parsePasskeyCredential)
			}
		},

		async removePasskey({
			credentialId,
			currentPassword
		}: {
			credentialId: string
			currentPassword?: string
		}): Promise<MfaActionResult> {
			const form = new FormData()
			form.set('credentialId', credentialId)
			if (currentPassword) form.set('currentPassword', currentPassword)
			const value = await readJsonRecord(
				await authFetch(withBase(resolved.passkeyCredentials), {
					method: 'POST',
					body: form
				})
			)
			return parsePasskeyAction(value)
		},

		async stepUpWithPasskey(): Promise<MfaActionResult> {
			if (!supportsPasskeys()) {
				throw new Error('WebAuthn not supported in this environment')
			}
			const optionsRes = await authFetch(withBase(resolved.passkeyStepUpOptions), {
				method: 'POST'
			})
			const optionsResult = parsePasskeyOptions(await readJsonRecord(optionsRes))
			if (!optionsResult.success) return optionsResult
			const credential = await navigator.credentials.get({
				publicKey: parseRequestOptions(optionsResult.options)
			})
			const value = await readJsonRecord(
				await authFetch(withBase(resolved.passkeyStepUpVerify), {
					method: 'POST',
					headers: jsonHeaders,
					body: JSON.stringify({
						challengeId: optionsResult.challengeId,
						credential: serializeCredential(credential)
					})
				})
			)
			return parsePasskeyAction(value)
		},

		async getMfaStatus(): Promise<MfaStatusResult> {
			const response = await authFetch(withBase(resolved.mfaStatus), {
				method: 'GET'
			})
			const value = await readJsonRecord(response)
			if (!requireSuccessFlag(value)) return parseFailure(value)
			const status = value['status']
			if (
				!isRecord(status) ||
				typeof status['enabled'] !== 'boolean' ||
				(status['enabledAt'] !== null && typeof status['enabledAt'] !== 'string') ||
				typeof status['backupCodeCount'] !== 'number'
			) {
				throw new Error('Invalid authentication response')
			}
			return {
				success: true,
				status: {
					enabled: status['enabled'],
					enabledAt: status['enabledAt'],
					backupCodeCount: status['backupCodeCount']
				}
			}
		},

		async enrollMfa({
			currentPassword
		}: { currentPassword?: string } = {}): Promise<MfaEnrollmentResult> {
			const form = new FormData()
			if (currentPassword) form.set('currentPassword', currentPassword)
			const response = await authFetch(withBase(resolved.mfaEnroll), {
				method: 'POST',
				body: form
			})
			const value = await readJsonRecord(response)
			if (!requireSuccessFlag(value)) return parseFailure(value)
			const backupCodes = value['backupCodes']
			if (
				typeof value['secret'] !== 'string' ||
				typeof value['otpauthUrl'] !== 'string' ||
				!Array.isArray(backupCodes) ||
				!backupCodes.every((code): code is string => typeof code === 'string')
			) {
				throw new Error('Invalid authentication response')
			}
			return {
				success: true,
				secret: value['secret'],
				otpauthUrl: value['otpauthUrl'],
				backupCodes
			}
		},

		async verifyMfa({ token }: { token: string }): Promise<MfaActionResult> {
			const form = new FormData()
			form.set('token', token)
			const response = await authFetch(withBase(resolved.mfaVerify), {
				method: 'POST',
				body: form
			})
			return parseMfaAction(await readJsonRecord(response))
		},

		async disableMfa({
			token,
			backupCode,
			currentPassword
		}: {
			token?: string
			backupCode?: string
			currentPassword?: string
		} = {}): Promise<MfaActionResult> {
			const form = new FormData()
			if (token) form.set('token', token)
			if (backupCode) form.set('backupCode', backupCode)
			if (currentPassword) form.set('currentPassword', currentPassword)
			const response = await authFetch(withBase(resolved.mfaDisable), {
				method: 'POST',
				body: form
			})
			return parseMfaAction(await readJsonRecord(response))
		},

		async stepUpMfa({
			token,
			backupCode
		}: { token?: string; backupCode?: string } = {}): Promise<MfaActionResult> {
			const form = new FormData()
			if (token) form.set('token', token)
			if (backupCode) form.set('backupCode', backupCode)
			const response = await authFetch(withBase(resolved.mfaStepUp), {
				method: 'POST',
				body: form
			})
			return parseMfaAction(await readJsonRecord(response))
		},

		async useMfaBackupCode({ code }: { code: string }): Promise<MfaActionResult> {
			const form = new FormData()
			form.set('code', code)
			const response = await authFetch(withBase(resolved.mfaBackupCode), {
				method: 'POST',
				body: form
			})
			return parseMfaAction(await readJsonRecord(response))
		},

		async listSessions(): Promise<SessionListResult> {
			const response = await authFetch(withBase(resolved.sessions), {
				method: 'GET'
			})
			const value = await readJsonRecord(response)
			if (typeof value['ok'] !== 'boolean') throw new Error('Invalid authentication response')
			if (!value['ok']) return parseSessionFailure(value)
			if (!Array.isArray(value['sessions'])) throw new Error('Invalid authentication response')
			return { ok: true, sessions: value['sessions'].map(parseSessionSummary) }
		},

		async revokeSession({
			sessionId,
			all,
			others
		}: { sessionId?: string; all?: boolean; others?: boolean } = {}): Promise<SessionActionResult> {
			const response = await authFetch(withBase(resolved.sessionRevoke), {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({ sessionId, all, others })
			})
			const value = await readJsonRecord(response)
			if (typeof value['ok'] !== 'boolean') throw new Error('Invalid authentication response')
			return value['ok'] ? { ok: true } : parseSessionFailure(value)
		}
	}
}
