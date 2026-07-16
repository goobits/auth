import { base64UrlToBytes, bytesToBase64Url } from '@goobits/security/crypto'
import {
	type AuthenticationResponseJSON,
	type AuthenticatorTransportFuture,
	type RegistrationResponseJSON
} from '@simplewebauthn/server'
import { z } from 'zod'

import { isValidCredentialCounter } from '../adapters/webauthn/_credentialCounter.ts'

type ChallengeRecord = {
	id: string
	userId: string | null
	challenge: string
	type: string
	expiresAt: string | number | Date
}

type CredentialRecord = {
	credentialId: string
	userId: string
	publicKey: string
	counter: number
	transports?: string[] | null
}

export function toUint8Array(value: unknown): Uint8Array {
	if (!value) return new Uint8Array()
	if (value instanceof Uint8Array) return value
	if (value instanceof ArrayBuffer) return new Uint8Array(value)
	if (ArrayBuffer.isView(value)) {
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
	}
	if (typeof value === 'string') {
		return base64UrlToBytes(value)
	}
	if (Array.isArray(value) && value.every((entry) => typeof entry === 'number')) {
		return Uint8Array.from(value)
	}
	return new Uint8Array()
}

export function encodeCredential(value: unknown): string {
	return bytesToBase64Url(toUint8Array(value))
}

const registrationResponseSchema = z.custom<RegistrationResponseJSON>(
	(value: unknown): value is RegistrationResponseJSON =>
		typeof value === 'object' &&
		value !== null &&
		typeof (value as Record<string, unknown>)['id'] === 'string' &&
		((typeof (value as Record<string, unknown>)['rawId'] === 'string' &&
			(value as Record<string, unknown>)['type'] === 'public-key') ||
			!(
				'rawId' in (value as Record<string, unknown>) ||
				'type' in (value as Record<string, unknown>)
			))
)

const authenticationResponseSchema = z.custom<AuthenticationResponseJSON>(
	(value: unknown): value is AuthenticationResponseJSON =>
		typeof value === 'object' &&
		value !== null &&
		typeof (value as Record<string, unknown>)['id'] === 'string' &&
		((typeof (value as Record<string, unknown>)['rawId'] === 'string' &&
			(value as Record<string, unknown>)['type'] === 'public-key') ||
			!(
				'rawId' in (value as Record<string, unknown>) ||
				'type' in (value as Record<string, unknown>)
			))
)

export const registerVerifyRequestSchema = z.object({
	challengeId: z.string().min(1),
	credential: registrationResponseSchema,
	name: z.string().optional()
})

export const loginOptionsRequestSchema = z.object({
	email: z.string().optional()
})

export const loginVerifyRequestSchema = z.object({
	challengeId: z.string().min(1),
	credential: authenticationResponseSchema
})

export function toChallengeRecord(value: Record<string, unknown> | null): ChallengeRecord | null {
	if (!value) return null
	const id = value['id'] ?? value['challengeId']
	const userId = value['userId']
	const challenge = value['challenge']
	const type = value['type']
	const expiresAt = value['expiresAt']
	if (typeof id !== 'string') return null
	if (userId !== null && userId !== undefined && typeof userId !== 'string') {
		return null
	}
	if (typeof challenge !== 'string') return null
	if (typeof type !== 'string') return null
	if (
		typeof expiresAt !== 'string' &&
		typeof expiresAt !== 'number' &&
		!(expiresAt instanceof Date)
	) {
		return null
	}
	return {
		id,
		userId: userId ?? null,
		challenge,
		type,
		expiresAt
	}
}

export function toCredentialRecord(value: Record<string, unknown> | null): CredentialRecord | null {
	if (!value) return null
	const credentialId = value['credentialId']
	const userId = value['userId']
	const publicKey = value['publicKey']
	const counter = value['counter']
	const transports = value['transports']
	if (typeof credentialId !== 'string') return null
	if (typeof userId !== 'string') return null
	if (typeof publicKey !== 'string') return null
	if (!isValidCredentialCounter(counter)) return null
	if (
		transports !== undefined &&
		transports !== null &&
		(!Array.isArray(transports) || transports.some((entry) => typeof entry !== 'string'))
	) {
		return null
	}
	return {
		credentialId,
		userId,
		publicKey,
		counter,
		transports: transports ?? null
	}
}

export function credentialDescriptorFromRecord(
	cred: Record<string, unknown>
): { id: string; transports?: AuthenticatorTransportFuture[] } | null {
	const id = cred['credentialId'] ?? cred['credential_id']
	const transports = cred['transports']
	if (typeof id !== 'string') return null
	if (transports !== undefined && transports !== null) {
		if (!Array.isArray(transports) || transports.some((entry) => typeof entry !== 'string')) {
			return { id }
		}
		const filtered = transports.filter(
			(entry): entry is AuthenticatorTransportFuture =>
				entry === 'ble' ||
				entry === 'cable' ||
				entry === 'hybrid' ||
				entry === 'internal' ||
				entry === 'nfc' ||
				entry === 'smart-card' ||
				entry === 'usb'
		)
		return filtered.length > 0 ? { id, transports: filtered } : { id }
	}
	return { id }
}

export function toAuthenticatorTransports(
	transports: string[] | null | undefined
): AuthenticatorTransportFuture[] | undefined {
	if (!transports) return undefined
	const filtered = transports.filter(
		(entry): entry is AuthenticatorTransportFuture =>
			entry === 'ble' ||
			entry === 'cable' ||
			entry === 'hybrid' ||
			entry === 'internal' ||
			entry === 'nfc' ||
			entry === 'smart-card' ||
			entry === 'usb'
	)
	return filtered.length > 0 ? filtered : undefined
}
