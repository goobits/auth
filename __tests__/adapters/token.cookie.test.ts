import { describe, it, expect, vi } from 'vitest'
import { CookieTokenAdapter } from '../../src/adapters/oauth-token/cookie.ts'
import { createCookies } from '../test-kit.ts'

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

		await adapter.storeTokens('u1', 'google', {
			accessToken: 'tok',
			refreshToken: null,
			scope: null,
			accessTokenExpiresAt: new Date().toISOString()
		})
		const tokens = await adapter.getTokens('u1', 'google')
		expect(tokens?.accessToken).toBe('tok')
	})

	it('throws if cookies not set', async () => {
		const adapter = new CookieTokenAdapter({ encryptionKey: 'b'.repeat(64) })
		await expect(adapter.getTokens('u1', 'google')).rejects.toThrow(/Cookies not set/)
	})
})
