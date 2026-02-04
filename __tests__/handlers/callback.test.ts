import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OAuth2RequestError } from 'arctic'

const handleOAuthCallback = vi.fn(async ({ callbacks }: { callbacks?: any }) => {
	if (callbacks?.onAuthenticated) {
		await callbacks.onAuthenticated({ id: 'p1' }, { accessToken: 't1' })
	}
	return { id: 'p1' }
})
vi.mock('../../src/utils/oauth.ts', () => ({
	handleOAuthCallback: (...args: any[]) => handleOAuthCallback(...(args as [any]))
}))

import { createCallbackHandler } from '../../src/handlers/callback.ts'

function createEvent({ provider = 'google', method = 'GET', form = {} } = {}) {
	const headers = new Headers()
	if (method === 'POST') {
		headers.set('Content-Type', 'application/x-www-form-urlencoded')
	}
	const request = new Request('http://localhost/callback', {
		method,
		headers,
		body: method === 'POST' ? new URLSearchParams(form as Record<string, string>) : null
	})
	return {
		params: { provider },
		locals: {},
		url: new URL('http://localhost/callback?code=abc&state=123'),
		request
	}
}

function getRedirectLocation(err: { location?: string; headers?: Headers } | null) {
	return err?.location || err?.headers?.get?.('location')
}

beforeEach(() => {
	handleOAuthCallback.mockReset()
})

describe('createCallbackHandler', () => {
	it('rejects unknown provider', async () => {
		const handler = createCallbackHandler({
			providers: {} as any,
			onAuthenticated: vi.fn()
		})

		await expect(handler(createEvent({ provider: 'unknown' })))
			.rejects.toMatchObject({ status: 400 })
	})

	it('handles OAuth2RequestError as 400', async () => {
		handleOAuthCallback.mockImplementation(() => {
			throw new OAuth2RequestError('bad', 'invalid_grant', null as any, null as any)
		})

		const handler = createCallbackHandler({
			providers: { google: {} as any },
			onAuthenticated: vi.fn()
		})

		await expect(handler(createEvent({ provider: 'google' })))
			.rejects.toMatchObject({ status: 400 })
	})

	it('accepts apple POST form and calls onAuthenticated', async () => {
		const onAuthenticated = vi.fn()

		const handler = createCallbackHandler({
			providers: { apple: {} as any },
			onAuthenticated
		})

		try {
			await handler(createEvent({
				provider: 'apple',
				method: 'POST',
				form: { code: 'code123', state: 'state123', user: JSON.stringify({}) }
			}))
		} catch (err) {
			const error = err as { status?: number; headers?: Headers; location?: string }
			expect(error.status).toBe(302)
			expect(getRedirectLocation(error)).toBe('/')
		}

		expect(handleOAuthCallback).toHaveBeenCalledWith(expect.objectContaining({
			provider: 'apple',
			overrideParams: { code: 'code123', state: 'state123' }
		}))
		expect(onAuthenticated).toHaveBeenCalled()
	})
})
