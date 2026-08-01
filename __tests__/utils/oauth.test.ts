import { describe, expect, it } from 'vitest'

import {
	createOAuthCookies,
	getOAuthCallbackParams,
	validateOAuthCallback
} from '../../src/utils/oauth.ts'

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
		expect(state.value).toMatch(/^[A-Za-z0-9_-]{43}$/u)
		expect(code.value).toMatch(/^[A-Za-z0-9_-]{43}$/u)
		expect(code.value).not.toBe(state.value)
	})

	it('validates callback params with overrides', () => {
		const cookies = new MockCookies()
		cookies.set('google_oauth_state', 'abc', {})
		cookies.set('google_oauth_code_verifier', 'ver', {})
		const url = new URL('https://example.com/callback?code=bad&state=bad')
		const params = getOAuthCallbackParams(cookies, url, 'google', { code: 'ok', state: 'abc' })
		expect(validateOAuthCallback(params)).toBe(true)
	})

	it('does not fall back to query parameters when form overrides are explicitly missing', () => {
		const cookies = new MockCookies()
		cookies.set('apple_oauth_state', 'abc', {})
		cookies.set('apple_oauth_code_verifier', 'ver', {})
		const url = new URL('https://example.com/callback?code=query-code&state=abc')

		expect(
			getOAuthCallbackParams(cookies, url, 'apple', { code: null, state: null })
		).toMatchObject({ code: null, state: null })
	})

	it('rejects callback params with missing or mismatched state', () => {
		expect(
			validateOAuthCallback({
				code: 'ok',
				state: 'wrong',
				storedCodeVerifier: 'ver',
				storedState: 'abc'
			})
		).toBe(false)
		expect(
			validateOAuthCallback({
				code: 'ok',
				state: 'abc',
				storedCodeVerifier: 'ver',
				storedState: null
			})
		).toBe(false)
		expect(
			validateOAuthCallback({
				code: null,
				state: 'abc',
				storedCodeVerifier: 'ver',
				storedState: 'abc'
			})
		).toBe(false)
	})
})
