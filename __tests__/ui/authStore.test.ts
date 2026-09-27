import { afterEach, describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'

describe('auth store browser lifecycle', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
		vi.resetModules()
	})

	it('starts its automatic session check only when the store is subscribed', async () => {
		const fetcher = vi.fn(async () => new Response(null, { status: 204 }))
		vi.stubGlobal('window', {})
		vi.stubGlobal('fetch', fetcher)

		const { auth } = await import('../../src/ui/authStore.ts')

		expect(fetcher).not.toHaveBeenCalled()
		const unsubscribeFirst = auth.subscribe(() => {})
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
		const unsubscribeSecond = auth.subscribe(() => {})

		expect(fetcher).toHaveBeenCalledWith('/auth/session', {
			method: 'GET',
			headers: {},
			credentials: 'include'
		})
		expect(fetcher).toHaveBeenCalledOnce()
		unsubscribeSecond()
		unsubscribeFirst()
	})

	it.each([
		['a no-content response', () => new Response(null, { status: 204 })],
		['an unauthorized response', () => new Response(null, { status: 401 })],
		[
			'an anonymous response body',
			() =>
				new Response(JSON.stringify({ success: false }), {
					headers: { 'content-type': 'application/json' }
				})
		],
		['a network failure', () => Promise.reject(new Error('Network unavailable'))]
	])('clears a previously authenticated identity after %s', async (_name, sessionResult) => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({
					success: true,
					user: { id: 'user-1' },
					session: { id: 'session-1' }
				}))
			)
			.mockImplementationOnce(sessionResult)
		vi.stubGlobal('window', {})

		const { createAuthStore } = await import('../../src/ui/authStore.ts')
		const store = createAuthStore({ fetcher, autoCheck: false })
		await store.login('member@example.com', 'correct-password')
		expect(get(store)).toMatchObject({
			user: { id: 'user-1' },
			session: { id: 'session-1' },
			isAuthenticated: true
		})

		await store.checkSession()
		expect(get(store)).toEqual({
			user: null,
			session: null,
			isAuthenticated: false,
			loading: false,
			error: null
		})
	})
})
