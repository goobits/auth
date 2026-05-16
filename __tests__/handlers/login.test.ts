import { describe, expect, it, vi } from 'vitest'

import { createLoginHandler } from '../../src/handlers/login.ts'
import type { OAuthProvider } from '../../src/providers/base.ts'

function createCookies() {
	const store = new Map<string, { value: string; options: Record<string, unknown> }>()
	return {
		set: (name: string, value: string, options: Record<string, unknown>) => store.set(name, { value, options }),
		get: (name: string) => store.get(name)?.value ?? null,
		delete: (name: string) => store.delete(name),
		_store: store
	}
}

function createEvent({ provider = 'google', locals = {}, url = 'http://localhost/' } = {}) {
	return {
		cookies: createCookies(),
		params: { provider },
		locals,
		url: new URL(url)
	}
}

function getRedirectLocation(err: { location?: string; headers?: Headers } | null) {
	return err?.location || err?.headers?.get?.('location')
}

function createProvider(createAuthorizationURL?: () => URL): OAuthProvider {
	return {
		createAuthorizationURL: createAuthorizationURL ?? (() => new URL('https://example.com/auth')),
		getUserProfile: vi.fn(async() => ({
			profile: { id: 'u1', email: 'u1@example.com' },
			tokens: { accessToken: 'token' }
		}))
	}
}

describe('createLoginHandler', () => {
	it('rejects unknown provider', async() => {
		const handler = createLoginHandler({ providers: {} })
		const response = await handler(createEvent({ provider: 'unknown' }))
		expect(response.status).toBe(400)
	})

	it('redirects if already authenticated', async() => {
		const handler = createLoginHandler({
			providers: { google: { provider: createProvider(() => new URL('https://example.com')) } },
			redirectAfterLogin: '/home',
			isAuthenticated: () => true
		})

		await expect(handler(createEvent())).rejects.toMatchObject({ status: 302 })
	})

	it('sets apple response_mode to form_post', async() => {
		const createAuthorizationURL = vi.fn(() => new URL('https://apple.example.com/authorize'))
		const handler = createLoginHandler({
			providers: {
				apple: { provider: createProvider(createAuthorizationURL), scopes: [ 'email' ] }
			}
		})

		try {
			await handler(createEvent({ provider: 'apple' }))
		} catch(err: unknown) {
			const error = err as { status?: number; headers?: Headers; location?: string }
			const location = getRedirectLocation(error)
			expect(error.status).toBe(302)
			expect(location).toBeTruthy()
			if (location) {
				expect(new URL(location).searchParams.get('response_mode')).toBe('form_post')
			}
		}
		expect(createAuthorizationURL).toHaveBeenCalled()
	})

	it('stores safe returnTo values for callback redirects', async() => {
		const handler = createLoginHandler({
			allowedReturnToOrigins: [ 'https://billing.example' ],
			providers: {
				google: { provider: createProvider(() => new URL('https://example.com/auth')) }
			}
		})
		const event = createEvent({
			url: 'http://accounts.example/auth/signin/google?returnTo=https%3A%2F%2Fbilling.example%2Fsettings%3Ftab%3Dprofile'
		})

		await expect(handler(event)).rejects.toMatchObject({ status: 302 })
		expect(event.cookies.get('google_oauth_return_to')).toBe('https://billing.example/settings?tab=profile')
	})

	it('does not store unsafe returnTo values', async() => {
		const handler = createLoginHandler({
			providers: {
				google: { provider: createProvider(() => new URL('https://example.com/auth')) }
			}
		})
		const event = createEvent({
			url: 'http://accounts.example/auth/signin/google?returnTo=https%3A%2F%2Fevil.example%2F'
		})

		await expect(handler(event)).rejects.toMatchObject({ status: 302 })
		expect(event.cookies.get('google_oauth_return_to')).toBeNull()
	})
})
