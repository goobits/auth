import { describe, expect, it } from 'vitest'

import {
	createAesGcmOAuthTokenCodec,
	openOAuthTokens,
	serializeOAuthTokens
} from '../../src/adapters/oauth-token/index.ts'
import { KVTokenAdapter } from '../../src/adapters/oauth-token/KVTokenAdapter.ts'
import { encryptTokens } from '../../src/utils/crypto.ts'

const OLD_KEY = '1'.repeat(64)
const CURRENT_KEY = '2'.repeat(64)
const TOKENS = {
	accessToken: 'access',
	refreshToken: 'refresh',
	scope: 'profile',
	accessTokenExpiresAt: '2026-07-16T00:00:00.000Z'
}

function keyring(activeKeyId: string, keys: Record<string, string>): string {
	return JSON.stringify({ activeKeyId, keys })
}

function createNamespace() {
	const store = new Map<string, string>()
	return {
		get: async (key: string) => store.get(key) ?? null,
		put: async (key: string, value: string) => {
			store.set(key, value)
		},
		delete: async (key: string) => {
			store.delete(key)
		},
		store
	}
}

describe('AES-GCM OAuth token codec', () => {
	it('exposes record-bound payload helpers for application-owned transactions', async () => {
		const codec = createAesGcmOAuthTokenCodec({
			keyringJson: keyring('current', { current: CURRENT_KEY })
		})
		const context = { userId: 'u1', provider: 'google' }
		const ciphertext = await serializeOAuthTokens(TOKENS, codec, context)

		await expect(openOAuthTokens({ value: ciphertext, codec, context })).resolves.toEqual(TOKENS)
	})

	it('binds ciphertext to its user and provider record', async () => {
		const codec = createAesGcmOAuthTokenCodec({
			keyringJson: keyring('current', { current: CURRENT_KEY })
		})
		const ciphertext = await codec.encrypt(TOKENS, { userId: 'u1', provider: 'google' })

		await expect(codec.decrypt(ciphertext, { userId: 'u1', provider: 'google' })).resolves.toEqual({
			value: TOKENS,
			needsReseal: false
		})
		await expect(
			codec.decrypt(ciphertext, { userId: 'u2', provider: 'google' })
		).resolves.toBeNull()
		await expect(codec.decrypt(ciphertext, { userId: 'u1', provider: 'apple' })).resolves.toBeNull()
	})

	it('reads pre-keyring payloads only through an explicit legacy key ID', async () => {
		const ciphertext = await encryptTokens(TOKENS, OLD_KEY)
		const rotating = createAesGcmOAuthTokenCodec({
			keyringJson: keyring('current', { old: OLD_KEY, current: CURRENT_KEY }),
			legacyKeyId: 'old'
		})
		const withoutLegacyMapping = createAesGcmOAuthTokenCodec({
			keyringJson: keyring('current', { old: OLD_KEY, current: CURRENT_KEY })
		})

		await expect(
			rotating.decrypt(ciphertext, { userId: 'u1', provider: 'google' })
		).resolves.toEqual({ value: TOKENS, needsReseal: true })
		await expect(
			withoutLegacyMapping.decrypt(ciphertext, { userId: 'u1', provider: 'google' })
		).resolves.toBeNull()
	})

	it('lazily reseals retired-key payloads through a durable adapter', async () => {
		const namespace = createNamespace()
		const oldCodec = createAesGcmOAuthTokenCodec({
			keyringJson: keyring('old', { old: OLD_KEY })
		})
		namespace.store.set(
			'oauth_tokens:u1:google',
			await oldCodec.encrypt(TOKENS, { userId: 'u1', provider: 'google' })
		)
		const adapter = new KVTokenAdapter(namespace, {
			encryptionKeyringJson: keyring('current', { old: OLD_KEY, current: CURRENT_KEY })
		})

		await expect(adapter.getTokens('u1', 'google')).resolves.toEqual(TOKENS)
		expect(JSON.parse(namespace.store.get('oauth_tokens:u1:google') ?? '{}').keyId).toBe('current')
	})

	it('rejects ambiguous or disabled encryption configuration', () => {
		const namespace = createNamespace()
		const tokenCodec = createAesGcmOAuthTokenCodec({
			keyringJson: keyring('old', { old: OLD_KEY })
		})
		expect(
			() =>
				new KVTokenAdapter(namespace, {
					tokenCodec,
					encryptionKeyringJson: keyring('current', { current: CURRENT_KEY })
				})
		).toThrow(/exactly one OAuth token encryption source/)
		expect(
			() =>
				new KVTokenAdapter(namespace, {
					encrypt: false,
					encryptionKeyringJson: keyring('old', { old: OLD_KEY })
				})
		).toThrow(/cannot configure token encryption/)
	})
})
