import { describe, expect, it } from 'vitest'

import {
	createCookieLoginContext,
	normalizeSafeRedirectPath
} from '../../src/login-context/index.ts'

class MockCookies {
	store = new Map<string, { value: string; options?: Record<string, unknown> }>()

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

describe('cookie login context', () => {
	it('stores, reads, and clears named context cookies', () => {
		const context = createCookieLoginContext({
			cookies: {
				token: 'app_token',
				redirectTo: 'app_redirect'
			},
			options: { secure: false, maxAge: 60 }
		})
		const cookies = new MockCookies()

		context.set(cookies, { token: 'abc', redirectTo: '/app/home' })

		expect(context.get(cookies)).toEqual({
			token: 'abc',
			redirectTo: '/app/home'
		})
		expect(cookies.store.get('app_token')?.options?.httpOnly).toBe(true)
		expect(cookies.store.get('app_token')?.options?.secure).toBe(false)

		context.clear(cookies)

		expect(context.get(cookies)).toEqual({
			token: null,
			redirectTo: null
		})
	})

	it('takes context by reading once and deleting the backing cookies', () => {
		const context = createCookieLoginContext({
			cookies: {
				token: 'app_token',
				redirectTo: 'app_redirect'
			}
		})
		const cookies = new MockCookies()
		context.set(cookies, { token: 'abc', redirectTo: '/app/home' }, { secure: false })

		expect(context.take(cookies, ['redirectTo'])).toEqual({
			token: 'abc',
			redirectTo: '/app/home'
		})
		expect(context.get(cookies)).toEqual({
			token: 'abc',
			redirectTo: null
		})
	})
})

describe('safe redirect normalization', () => {
	it('normalizes relative redirects and enforces allowed prefixes', () => {
		expect(
			normalizeSafeRedirectPath('/app/a?x=1#top', {
				allowedPrefixes: ['/app']
			})
		).toBe('/app/a?x=1#top')

		expect(
			normalizeSafeRedirectPath('/admin', {
				allowedPrefixes: ['/app']
			})
		).toBeNull()
	})

	it('rejects absolute, protocol-relative, and control-character redirects', () => {
		expect(normalizeSafeRedirectPath('https://example.com/app')).toBeNull()
		expect(normalizeSafeRedirectPath('//example.com/app')).toBeNull()
		expect(normalizeSafeRedirectPath('/\\example.com/app')).toBeNull()
		expect(normalizeSafeRedirectPath('/%2fexample.com/app')).toBeNull()
		expect(normalizeSafeRedirectPath('/%5cexample.com/app')).toBeNull()
		expect(normalizeSafeRedirectPath('/app\nLocation: /admin')).toBeNull()
		expect(normalizeSafeRedirectPath('/app', { baseUrl: 'not a url' })).toBeNull()
	})
})
