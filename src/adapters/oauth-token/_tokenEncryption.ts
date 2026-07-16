import type { OAuthTokenCodec, OAuthTokenEncryptionOptions } from './OAuthTokenCodec.ts'
import { createAesGcmOAuthTokenCodec } from './OAuthTokenCodec.ts'

export function resolveOAuthTokenCodec(
	options: OAuthTokenEncryptionOptions,
	adapterName: string
): OAuthTokenCodec | null {
	const hasCodec = options.tokenCodec !== undefined
	const hasKeyring = !!options.encryptionKeyringJson
	const hasLegacyKey = !!options.encryptionKey
	const configuredSources = Number(hasCodec) + Number(hasKeyring) + Number(hasLegacyKey)

	if (options.encrypt === false) {
		if (configuredSources > 0 || options.legacyEncryptionKeyId !== undefined) {
			throw new Error(`${adapterName} cannot configure token encryption when encrypt is false`)
		}
		return null
	}
	if (configuredSources > 1) {
		throw new Error(`${adapterName} accepts exactly one OAuth token encryption source`)
	}
	if (options.tokenCodec) return options.tokenCodec
	if (options.encryptionKeyringJson) {
		return createAesGcmOAuthTokenCodec({
			keyringJson: options.encryptionKeyringJson,
			...(options.legacyEncryptionKeyId ? { legacyKeyId: options.legacyEncryptionKeyId } : {})
		})
	}
	if (options.encryptionKey) {
		const keyId = options.legacyEncryptionKeyId ?? 'legacy'
		return createAesGcmOAuthTokenCodec({
			keyringJson: JSON.stringify({
				activeKeyId: keyId,
				keys: { [keyId]: options.encryptionKey }
			}),
			legacyKeyId: keyId
		})
	}
	throw new Error(
		`${adapterName} requires tokenCodec, encryptionKeyringJson, or encryptionKey when encryption is enabled`
	)
}
