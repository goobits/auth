import {
	type AesGcmKeyring,
	type AesGcmKeyringSeal,
	bytesToText,
	createAesGcmKeyringFromJson,
	openAesGcmWithKeyring,
	parseAesGcmKeyringSeal,
	sealAesGcmWithKeyring
} from '@goobits/security/crypto'

import type { MfaSecretCodec } from './MfaAdapter.ts'

const DEFAULT_ASSOCIATED_DATA_PREFIX = '@goobits/auth:mfa-secret'

function parseSeal(ciphertext: string): AesGcmKeyringSeal {
	try {
		return parseAesGcmKeyringSeal(JSON.parse(ciphertext))
	} catch {
		throw new Error('@goobits/auth: invalid encrypted MFA secret')
	}
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
