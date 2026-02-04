import { describe, it, expect } from 'vitest'
import { KVTokenAdapter } from '../../src/adapters/token/kv.js'

function createNamespace() {
	const store = new Map()
	return {
		get: async (key) => store.get(key) ?? null,
		put: async (key, value) => { store.set(key, value) },
		delete: async (key) => { store.delete(key) },
		_store: store
	}
}

describe('KVTokenAdapter', () => {
	it('requires encryption key when encrypting', () => {
		expect(() => new KVTokenAdapter(createNamespace())).toThrow(/encryptionKey/)
	})

	it('roundtrips tokens when encryption is disabled', async () => {
		const namespace = createNamespace()
		const adapter = new KVTokenAdapter(namespace, { encrypt: false })
		await adapter.storeTokens('u1', 'google', { access_token: 'tok' })
		const tokens = await adapter.getTokens('u1', 'google')
		expect(tokens.access_token).toBe('tok')
	})
})
