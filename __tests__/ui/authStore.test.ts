import { afterEach, describe, expect, it, vi } from 'vitest'

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
})
