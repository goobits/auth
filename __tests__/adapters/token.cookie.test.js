import { describe, it, expect, vi } from 'vitest'
import { CookieTokenAdapter } from '../../src/adapters/token/cookie.js'

function createCookies() {
	const store = new Map()
	return {
		set: (name, value, options) => store.set(name, { value, options }),
		get: (name) => store.get(name)?.value ?? null,
		delete: (name) => store.delete(name),
		_store: store
	}
}

describe('CookieTokenAdapter', () => {
	it('requires encryption key', () => {
		expect(() => new CookieTokenAdapter({})).toThrow(/encryptionKey/)
	})

	it('stores and retrieves encrypted tokens', async () => {
		const adapter = new CookieTokenAdapter({
			encryptionKey: 'a'.repeat(64),
			secureCookies: false
		})
		const cookies = createCookies()
		adapter._setCookies(cookies)

		await adapter.storeTokens('u1', 'google', { access_token: 'tok' })
		const tokens = await adapter.getTokens('u1', 'google')
		expect(tokens.access_token).toBe('tok')
	})

	it('throws if cookies not set', async () => {
		const adapter = new CookieTokenAdapter({ encryptionKey: 'b'.repeat(64) })
		await expect(adapter.getTokens('u1', 'google')).rejects.toThrow(/Cookies not set/)
	})
})
