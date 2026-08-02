import { describe, expect, it, vi } from 'vitest'

import {
	createOAuthCookies,
	getOAuthCallbackParams,
	handleOAuthCallback,
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
		createOAuthCookies(cookies, 'google', {
			intent: 'link',
			userId: 'user-1',
			redirectTo: '/settings/security',
			secure: false,
			maxAge: 10,
			sameSite: 'lax'
		})
		const state = cookies.store.get('google_oauth_state')
		const code = cookies.store.get('google_oauth_code_verifier')
		const context = cookies.store.get('google_oauth_context')
		if (!state || !code || !context) throw new Error('Missing oauth cookies')
		expect(state.options?.sameSite).toBe('lax')
		expect(state.options?.secure).toBe(false)
		expect(code.options?.secure).toBe(false)
		expect(state.value).toMatch(/^[A-Za-z0-9_-]{43}$/u)
		expect(code.value).toMatch(/^[A-Za-z0-9_-]{43}$/u)
		expect(code.value).not.toBe(state.value)
		expect(JSON.parse(context.value)).toEqual({
			state: state.value,
			intent: 'link',
			userId: 'user-1',
			redirectTo: '/settings/security'
		})
		expect(context.options?.httpOnly).toBe(true)
	})

	it('passes the state-bound flow context through a successful callback', async () => {
		const cookies = new MockCookies()
		const { state, codeVerifier } = createOAuthCookies(cookies, 'google', {
			intent: 'sign-in',
			userId: null,
			redirectTo: '/library',
			secure: true
		})
		const onAuthenticated = vi.fn()
		const provider = {
			getUserProfile: vi.fn(async () => ({
				profile: { id: 'google-subject', email: 'member@example.com' },
				tokens: {
					accessToken: 'access-token',
					refreshToken: null,
					scope: null,
					accessTokenExpiresAt: '2099-01-01T00:00:00.000Z'
				}
			}))
		} as never

		await handleOAuthCallback({
			event: {
				cookies,
				request: new Request(`https://example.com/callback?code=code&state=${state}`),
				url: new URL(`https://example.com/callback?code=code&state=${state}`)
			},
			provider: 'google',
			providerInstance: provider,
			callbacks: { onAuthenticated }
		})

		expect(provider.getUserProfile).toHaveBeenCalledWith('code', codeVerifier)
		expect(onAuthenticated).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'google-subject' }),
			expect.objectContaining({ accessToken: 'access-token' }),
			{ intent: 'sign-in', userId: null, redirectTo: '/library' }
		)
		expect(cookies.get('google_oauth_context')).toBeNull()
	})

	it('rejects a flow context that is not bound to the callback state', async () => {
		const cookies = new MockCookies()
		const { state } = createOAuthCookies(cookies, 'google', {
			intent: 'link',
			userId: 'user-1',
			secure: true
		})
		cookies.set(
			'google_oauth_context',
			JSON.stringify({ state: 'different-state', intent: 'link', userId: 'user-1', redirectTo: '' })
		)

		await expect(
			handleOAuthCallback({
				event: {
					cookies,
					request: new Request(`https://example.com/callback?code=code&state=${state}`),
					url: new URL(`https://example.com/callback?code=code&state=${state}`)
				},
				provider: 'google',
				providerInstance: { getUserProfile: vi.fn() } as never,
				callbacks: {}
			})
		).rejects.toThrow('Invalid OAuth flow context')
		expect(cookies.get('google_oauth_state')).toBeNull()
		expect(cookies.get('google_oauth_code_verifier')).toBeNull()
		expect(cookies.get('google_oauth_context')).toBeNull()
	})

	it('rejects intent context without the matching principal binding', () => {
		const cookies = new MockCookies()
		expect(() =>
			createOAuthCookies(cookies, 'google', {
				intent: 'sign-in',
				userId: 'unexpected-user'
			})
		).toThrow('Invalid OAuth flow context')
		expect(() =>
			createOAuthCookies(cookies, 'google', {
				intent: 'link',
				userId: null
			})
		).toThrow('Invalid OAuth flow context')
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
