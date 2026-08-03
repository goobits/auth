import {
	bytesToText,
	createAesGcmKeyringFromJson,
	openAesGcmWithKeyring,
	parseAesGcmKeyringSeal,
	parseAesGcmSeal,
	sealAesGcmWithKeyring,
	type AesGcmKeyring,
	type AesGcmKeyringSeal
} from '@goobits/security/crypto'

const DEFAULT_ASSOCIATED_DATA_PREFIX = '@goobits/auth:oauth-token'

/** Record identity bound to an encrypted OAuth token payload. */
export interface OAuthTokenCipherContext {
	userId: string
	provider: string
}

/** Successful token opening, including whether the payload uses a retired format or key. */
export interface OpenedOAuthTokenPayload {
	value: unknown
	needsReseal: boolean
}

/** Application-replaceable OAuth token encryption boundary. */
export interface OAuthTokenCodec {
	encrypt(value: unknown, context: OAuthTokenCipherContext): Promise<string>
	decrypt(
		ciphertext: string,
		context: OAuthTokenCipherContext
	): Promise<OpenedOAuthTokenPayload | null>
}

/** Shared encryption options accepted by durable OAuth token adapters. */
export interface OAuthTokenEncryptionOptions {
	encrypt?: boolean
	tokenCodec?: OAuthTokenCodec
	encryptionKeyringJson?: string | null
	legacyEncryptionKeyId?: string
}

/** Rotation and record-binding options for the built-in AES-GCM token codec. */
export interface AesGcmOAuthTokenCodecOptions {
	keyringJson: string
	/** Key ID assigned to pre-keyring AES-GCM payloads during a rolling migration. */
	legacyKeyId?: string
	associatedDataPrefix?: string
}

function associatedData(prefix: string, context: OAuthTokenCipherContext): string {
	if (!context.userId || !context.provider) {
		throw new Error('@goobits/auth: OAuth token user ID and provider are required')
	}
	return JSON.stringify([prefix, context.userId, context.provider])
}

function parseSerializedSeal(
	ciphertext: string
):
	| { kind: 'keyring'; sealed: AesGcmKeyringSeal }
	| { kind: 'legacy'; sealed: ReturnType<typeof parseAesGcmSeal> } {
	let parsed: unknown
	try {
		parsed = JSON.parse(ciphertext)
	} catch {
		throw new Error('@goobits/auth: invalid encrypted OAuth token payload')
	}
	if (typeof parsed === 'object' && parsed !== null && 'keyId' in parsed) {
		return { kind: 'keyring', sealed: parseAesGcmKeyringSeal(parsed) }
	}
	return { kind: 'legacy', sealed: parseAesGcmSeal(parsed) }
}

/** Builds a rotation-ready, record-bound OAuth token codec. */
export function createAesGcmOAuthTokenCodec({
	keyringJson,
	legacyKeyId,
	associatedDataPrefix = DEFAULT_ASSOCIATED_DATA_PREFIX
}: AesGcmOAuthTokenCodecOptions): OAuthTokenCodec {
	if (!associatedDataPrefix.trim()) {
		throw new Error('@goobits/auth: OAuth token associated-data prefix is required')
	}
	const keyring: AesGcmKeyring = createAesGcmKeyringFromJson(keyringJson)

	return {
		async encrypt(value, context) {
			return JSON.stringify(
				await sealAesGcmWithKeyring({
					keyring,
					plaintext: JSON.stringify(value),
					associatedData: associatedData(associatedDataPrefix, context)
				})
			)
		},
		async decrypt(ciphertext, context) {
			try {
				const parsed = parseSerializedSeal(ciphertext)
				let plaintext: Uint8Array
				let needsReseal: boolean
				if (parsed.kind === 'keyring') {
					plaintext = await openAesGcmWithKeyring({
						keyring,
						sealed: parsed.sealed,
						associatedData: associatedData(associatedDataPrefix, context)
					})
					needsReseal = parsed.sealed.keyId !== keyring.activeKeyId
				} else {
					if (!legacyKeyId) return null
					plaintext = await openAesGcmWithKeyring({
						keyring,
						sealed: { keyId: legacyKeyId, seal: parsed.sealed }
					})
					needsReseal = true
				}
				return { value: JSON.parse(bytesToText(plaintext)), needsReseal }
			} catch {
				return null
			}
		}
	}
}
