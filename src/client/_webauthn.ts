import { base64UrlToBytes, bytesToBase64Url } from '@goobits/security/crypto/encoding'

import {
	parsePasskeyAction,
	parsePasskeyCredential,
	parsePasskeyOptions,
	readJsonRecord
} from './_response.ts'
import type { AuthClientContext, MfaActionResult, PasskeyListResult } from './_types.ts'

type Base64Input = ArrayBuffer | ArrayBufferView | Uint8Array | string | null | undefined

export function supportsPasskeys(): boolean {
	return (
		typeof globalThis.PublicKeyCredential !== 'undefined' &&
		Boolean(globalThis.navigator?.credentials)
	)
}

export async function supportsConditionalPasskeys(): Promise<boolean> {
	if (!supportsPasskeys()) return false
	const capability = PublicKeyCredential.isConditionalMediationAvailable
	return typeof capability === 'function' && (await capability.call(PublicKeyCredential))
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

function parseCreationOptions(options: Record<string, unknown>): PublicKeyCredentialCreationOptions {
	const parsed = { ...options } as Record<string, unknown>
	parsed['challenge'] = toUint8Array((options as { challenge?: Base64Input })['challenge'])
	const user = (options as { user?: { id?: Base64Input } }).user
	if (user?.id) parsed['user'] = { ...user, id: toUint8Array(user.id) }
	const exclude = (options as { excludeCredentials?: Array<{ id?: Base64Input }> })
		.excludeCredentials
	if (Array.isArray(exclude)) {
		parsed['excludeCredentials'] = exclude.map((credential) => ({
			...credential,
			id: toUint8Array(credential.id)
		}))
	}
	return parsed as unknown as PublicKeyCredentialCreationOptions
}

function parseRequestOptions(options: Record<string, unknown>): PublicKeyCredentialRequestOptions {
	const parsed = { ...options } as Record<string, unknown>
	parsed['challenge'] = toUint8Array((options as { challenge?: Base64Input })['challenge'])
	const allow = (options as { allowCredentials?: Array<{ id?: Base64Input }> }).allowCredentials
	if (Array.isArray(allow)) {
		parsed['allowCredentials'] = allow.map((credential) => ({
			...credential,
			id: toUint8Array(credential.id)
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

export function createPasskeyClient(context: AuthClientContext) {
	const { authFetch, endpoints, jsonHeaders, withBase } = context
	return {
		async registerPasskey({
			name,
			currentPassword
		}: { name?: string; currentPassword?: string } = {}) {
			if (!supportsPasskeys()) throw new Error('WebAuthn not supported in this environment')
			const authorization = new FormData()
			if (currentPassword) authorization.set('currentPassword', currentPassword)
			const optionsResult = parsePasskeyOptions(
				await readJsonRecord(
					await authFetch(withBase(endpoints.passkeyRegisterOptions), {
						method: 'POST',
						body: authorization
					})
				)
			)
			if (!optionsResult.success) return optionsResult
			const credential = await navigator.credentials.create({
				publicKey: parseCreationOptions(optionsResult.options)
			})
			return parsePasskeyAction(
				await readJsonRecord(
					await authFetch(withBase(endpoints.passkeyRegisterVerify), {
						method: 'POST',
						headers: jsonHeaders,
						body: JSON.stringify({
							challengeId: optionsResult.challengeId,
							credential: serializeCredential(credential),
							name
						})
					})
				)
			)
		},

		async loginWithPasskey({
			conditional = false,
			signal
		}: { conditional?: boolean; signal?: AbortSignal } = {}) {
			if (!supportsPasskeys()) throw new Error('WebAuthn not supported in this environment')
			if (conditional && !(await supportsConditionalPasskeys())) {
				throw new Error('Conditional WebAuthn not supported in this environment')
			}
			const optionsResult = parsePasskeyOptions(
				await readJsonRecord(
					await authFetch(withBase(endpoints.passkeyLoginOptions), { method: 'POST' })
				)
			)
			if (!optionsResult.success) return optionsResult
			const credential = await navigator.credentials.get({
				publicKey: parseRequestOptions(optionsResult.options),
				...(conditional ? { mediation: 'conditional' as const } : {}),
				...(signal ? { signal } : {})
			})
			return parsePasskeyAction(
				await readJsonRecord(
					await authFetch(withBase(endpoints.passkeyLoginVerify), {
						method: 'POST',
						headers: jsonHeaders,
						body: JSON.stringify({
							challengeId: optionsResult.challengeId,
							credential: serializeCredential(credential)
						})
					})
				)
			)
		},

		async listPasskeys(): Promise<PasskeyListResult> {
			const value = await readJsonRecord(
				await authFetch(withBase(endpoints.passkeyCredentials), { method: 'GET' })
			)
			if (value['ok'] === false) {
				return {
					success: false,
					error:
						typeof value['error'] === 'string'
							? value['error']
							: 'Authentication request failed'
				}
			}
			if (value['ok'] !== true || !Array.isArray(value['credentials'])) {
				throw new Error('Invalid authentication response')
			}
			return { success: true, credentials: value['credentials'].map(parsePasskeyCredential) }
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
			return parsePasskeyAction(
				await readJsonRecord(
					await authFetch(withBase(endpoints.passkeyCredentials), {
						method: 'POST',
						body: form
					})
				)
			)
		},

		async stepUpWithPasskey(): Promise<MfaActionResult> {
			if (!supportsPasskeys()) throw new Error('WebAuthn not supported in this environment')
			const optionsResult = parsePasskeyOptions(
				await readJsonRecord(
					await authFetch(withBase(endpoints.passkeyStepUpOptions), { method: 'POST' })
				)
			)
			if (!optionsResult.success) return optionsResult
			const credential = await navigator.credentials.get({
				publicKey: parseRequestOptions(optionsResult.options)
			})
			return parsePasskeyAction(
				await readJsonRecord(
					await authFetch(withBase(endpoints.passkeyStepUpVerify), {
						method: 'POST',
						headers: jsonHeaders,
						body: JSON.stringify({
							challengeId: optionsResult.challengeId,
							credential: serializeCredential(credential)
						})
					})
				)
			)
		}
	}
}
