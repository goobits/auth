import { describe, it, expect } from 'vitest'
import { createOAuthCookies, getOAuthCallbackParams, validateOAuthCallback } from '../../src/utils/oauth.ts'

class MockCookies {
	store: Map<string, { value: string; options?: Record<string, unknown> }>
	constructor() {
		this.store = new Map()
	}
	set(name: string, value: string, options?: Record<string, unknown>) {
		this.store.set(name, { value, options })
	}
	get(name: string) {
		return this.store.get(name)?.value ?? null
	}
	delete(name: string) {
		this.store.delete(name)
	}
}

describe('oauth cookies', () => {
	it('sets lax sameSite and respects secure option', () => {
		const cookies = new MockCookies()
		createOAuthCookies(cookies, 'google', { secure: false, maxAge: 10, sameSite: 'lax' })
		const state = cookies.store.get('google_oauth_state')
		const code = cookies.store.get('google_oauth_code_verifier')
		if (!state || !code) throw new Error('Missing oauth cookies')
		expect(state.options?.sameSite).toBe('lax')
		expect(state.options?.secure).toBe(false)
		expect(code.options?.secure).toBe(false)
	})

	it('validates callback params with overrides', () => {
		const cookies = new MockCookies()
		cookies.set('google_oauth_state', 'abc', {})
		cookies.set('google_oauth_code_verifier', 'ver', {})
		const url = new URL('https://example.com/callback?code=bad&state=bad')
		const params = getOAuthCallbackParams(cookies, url, 'google', { code: 'ok', state: 'abc' })
		expect(validateOAuthCallback(params)).toBe(true)
	})
})
