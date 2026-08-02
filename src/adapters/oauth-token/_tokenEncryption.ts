import {
	createAesGcmOAuthTokenCodec,
	type OAuthTokenCodec,
	type OAuthTokenEncryptionOptions
} from './OAuthTokenCodec.ts'

export function resolveOAuthTokenCodec(
	options: OAuthTokenEncryptionOptions,
	adapterName: string
): OAuthTokenCodec | null {
	const hasCodec = options.tokenCodec !== undefined
	const hasKeyring = !!options.encryptionKeyringJson
	const configuredSources = Number(hasCodec) + Number(hasKeyring)

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
	throw new Error(
		`${adapterName} requires tokenCodec or encryptionKeyringJson when encryption is enabled`
	)
}
