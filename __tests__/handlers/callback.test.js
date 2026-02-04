import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OAuth2RequestError } from 'arctic'

const handleOAuthCallback = vi.fn()
vi.mock('../../src/utils/oauth.js', () => ({
	handleOAuthCallback: (...args) => handleOAuthCallback(...args)
}))

import { createCallbackHandler } from '../../src/handlers/callback.js'

function createEvent({ provider = 'google', method = 'GET', form = {} } = {}) {
	const request = new Request('http://localhost/callback', {
		method,
		headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
		body: method === 'POST' ? new URLSearchParams(form) : undefined
	})
	return {
		params: { provider },
		locals: {},
		url: new URL('http://localhost/callback?code=abc&state=123'),
		request
	}
}

function getRedirectLocation(err) {
	return err?.location || err?.headers?.get?.('location')
}

beforeEach(() => {
	handleOAuthCallback.mockReset()
})

describe('createCallbackHandler', () => {
	it('rejects unknown provider', async () => {
		const handler = createCallbackHandler({
			providers: {},
			onAuthenticated: vi.fn()
		})

		await expect(handler(createEvent({ provider: 'unknown' })))
			.rejects.toMatchObject({ status: 400 })
	})

	it('handles OAuth2RequestError as 400', async () => {
		handleOAuthCallback.mockImplementation(() => {
			throw new OAuth2RequestError('bad', 'invalid_grant')
		})

		const handler = createCallbackHandler({
			providers: { google: {} },
			onAuthenticated: vi.fn()
		})

		await expect(handler(createEvent({ provider: 'google' })))
			.rejects.toMatchObject({ status: 400 })
	})

	it('accepts apple POST form and calls onAuthenticated', async () => {
		const onAuthenticated = vi.fn()
		handleOAuthCallback.mockResolvedValue({ id: 'p1' })

		const handler = createCallbackHandler({
			providers: { apple: {} },
			onAuthenticated
		})

		try {
			await handler(createEvent({
				provider: 'apple',
				method: 'POST',
				form: { code: 'code123', state: 'state123', user: JSON.stringify({}) }
			}))
		} catch (err) {
			expect(err.status).toBe(302)
			expect(getRedirectLocation(err)).toBe('/')
		}

		expect(handleOAuthCallback).toHaveBeenCalledWith(expect.objectContaining({
			provider: 'apple',
			overrideParams: { code: 'code123', state: 'state123' }
		}))
		expect(onAuthenticated).toHaveBeenCalled()
	})
})
