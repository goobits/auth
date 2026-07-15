import { describe, expect, it, vi } from 'vitest'

import { createAuthClient } from '../src/client/index.ts'

function createFetcher() {
	return vi.fn(
		async () =>
			new Response(JSON.stringify({ ok: true }), {
				headers: { 'content-type': 'application/json' }
			})
	) as unknown as typeof fetch
}

describe('auth client', () => {
	it('uses the shared CSRF fetch pipeline for unsafe same-origin requests', async () => {
		const fetcher = createFetcher()
		const client = createAuthClient({
			baseUrl: 'https://bandamp.test',
			csrf: {
				baseUrl: 'https://bandamp.test/account',
				readToken: () => 'csrf-token'
			},
			fetcher
		})

		await client.disableMfa()
		const [, init] = vi.mocked(fetcher).mock.calls[0] ?? []
		expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('csrf-token')
	})

	it('does not attach a CSRF token to safe or cross-origin requests', async () => {
		const fetcher = createFetcher()
		const sameOriginClient = createAuthClient({
			baseUrl: 'https://bandamp.test',
			csrf: {
				baseUrl: 'https://bandamp.test/account',
				readToken: () => 'csrf-token'
			},
			fetcher
		})
		await sameOriginClient.listSessions()

		const crossOriginClient = createAuthClient({
			baseUrl: 'https://api.example.test',
			csrf: {
				baseUrl: 'https://bandamp.test/account',
				readToken: () => 'csrf-token'
			},
			fetcher
		})
		await crossOriginClient.disableMfa()

		const [, safeInit] = vi.mocked(fetcher).mock.calls[0] ?? []
		const [, crossOriginInit] = vi.mocked(fetcher).mock.calls[1] ?? []
		expect(new Headers(safeInit?.headers).has('X-CSRF-Token')).toBe(false)
		expect(new Headers(crossOriginInit?.headers).has('X-CSRF-Token')).toBe(false)
	})
})
