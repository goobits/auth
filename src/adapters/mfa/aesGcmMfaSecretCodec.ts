import {
	type AesGcmKeyring,
	type AesGcmKeyringSeal,
	bytesToText,
	createAesGcmKeyringFromJson,
	openAesGcmWithKeyring,
	sealAesGcmWithKeyring
} from '@goobits/security/crypto'

import type { MfaSecretCodec } from './MfaAdapter.ts'

const DEFAULT_ASSOCIATED_DATA_PREFIX = '@goobits/auth:mfa-secret'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSeal(ciphertext: string): AesGcmKeyringSeal {
	let value: unknown
	try {
		value = JSON.parse(ciphertext)
	} catch {
		throw new Error('@goobits/auth: invalid encrypted MFA secret')
	}
	if (
		!isRecord(value) ||
		Object.keys(value).some((key) => key !== 'keyId' && key !== 'seal') ||
		typeof value['keyId'] !== 'string' ||
		!isRecord(value['seal']) ||
		Object.keys(value['seal']).some(
			(key) => key !== 'algorithm' && key !== 'iv' && key !== 'ciphertext'
		) ||
		value['seal']['algorithm'] !== 'AES-GCM' ||
		typeof value['seal']['iv'] !== 'string' ||
		typeof value['seal']['ciphertext'] !== 'string'
	) {
		throw new Error('@goobits/auth: invalid encrypted MFA secret')
	}
	return value as unknown as AesGcmKeyringSeal
}

/** Builds an MFA-secret codec backed by Security's rotation-ready AES-GCM keyring. */
export function createAesGcmMfaSecretCodec({
	keyringJson,
	associatedDataPrefix = DEFAULT_ASSOCIATED_DATA_PREFIX
}: {
	keyringJson: string
	associatedDataPrefix?: string
}): MfaSecretCodec {
	if (!associatedDataPrefix.trim()) {
		throw new Error('@goobits/auth: MFA associated-data prefix is required')
	}
	const keyring: AesGcmKeyring = createAesGcmKeyringFromJson(keyringJson)
	const associatedData = (userId: string) => `${associatedDataPrefix}:${userId}`
	return {
		async encrypt(secret, userId) {
			if (!secret || !userId) throw new Error('@goobits/auth: MFA secret and user ID are required')
			return JSON.stringify(
				await sealAesGcmWithKeyring({
					keyring,
					plaintext: secret,
					associatedData: associatedData(userId)
				})
			)
		},
		async decrypt(ciphertext, userId) {
			if (!ciphertext || !userId) {
				throw new Error('@goobits/auth: encrypted MFA secret and user ID are required')
			}
			try {
				return bytesToText(
					await openAesGcmWithKeyring({
						keyring,
						sealed: parseSeal(ciphertext),
						associatedData: associatedData(userId)
					})
				)
			} catch {
				throw new Error('@goobits/auth: unable to decrypt MFA secret')
			}
		}
	}
}
