import { describe, it, expect, vi } from 'vitest'
import { createLoginHandler } from '../../src/handlers/login.js'

function createCookies() {
	const store = new Map()
	return {
		set: (name, value, options) => store.set(name, { value, options }),
		get: (name) => store.get(name)?.value ?? null,
		delete: (name) => store.delete(name),
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

function getRedirectLocation(err) {
	return err?.location || err?.headers?.get?.('location')
}

describe('createLoginHandler', () => {
	it('rejects unknown provider', async () => {
		const handler = createLoginHandler({ providers: {} })
		const response = await handler(createEvent({ provider: 'unknown' }))
		expect(response.status).toBe(400)
	})

	it('redirects if already authenticated', async () => {
		const handler = createLoginHandler({
			providers: { google: { provider: { createAuthorizationURL: () => new URL('https://example.com') } } },
			redirectAfterLogin: '/home',
			isAuthenticated: () => true
		})

		await expect(handler(createEvent())).rejects.toMatchObject({ status: 302 })
	})

	it('sets apple response_mode to form_post', async () => {
		const createAuthorizationURL = vi.fn(() => new URL('https://apple.example.com/authorize'))
		const handler = createLoginHandler({
			providers: {
				apple: { provider: { createAuthorizationURL }, scopes: ['email'] }
			}
		})

		try {
			await handler(createEvent({ provider: 'apple' }))
		} catch (err) {
			const location = getRedirectLocation(err)
			expect(err.status).toBe(302)
			expect(location).toBeTruthy()
			expect(new URL(location).searchParams.get('response_mode')).toBe('form_post')
		}
		expect(createAuthorizationURL).toHaveBeenCalled()
	})
})
