import { describe, expect, it, vi } from 'vitest'

import { createAuthClient } from '../src/client/index.ts'

function createFetcher(body: unknown = { success: true, ok: true, sessions: [] }) {
	return vi.fn(
		async () =>
			new Response(JSON.stringify(body), {
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

	it('shares canonical facade routes and merges configured request headers', async () => {
		const fetcher = createFetcher()
		const client = createAuthClient({ fetcher, headers: { 'x-app': 'bandamp' } })

		await client.sendMagicLink({ email: 'member@example.com' })
		await client.verifyMagicLink({ token: 'token' })
		await client.stepUpMfa({ token: '123456' })

		expect(vi.mocked(fetcher).mock.calls.map(([url]) => String(url))).toEqual([
			'/auth/magic-link',
			'/auth/magic-link/verify',
			'/auth/mfa/step-up'
		])
		for (const [, init] of vi.mocked(fetcher).mock.calls) {
			expect(new Headers(init?.headers).get('x-app')).toBe('bandamp')
		}
	})

	it('validates MFA responses at the public client boundary', async () => {
		const client = createAuthClient({
			fetcher: createFetcher({
				success: true,
				secret: 'secret',
				otpauthUrl: 'otpauth://totp/example',
				backupCodes: ['backup-1']
			})
		})

		await expect(client.enrollMfa()).resolves.toEqual({
			success: true,
			secret: 'secret',
			otpauthUrl: 'otpauth://totp/example',
			backupCodes: ['backup-1']
		})

		const invalidClient = createAuthClient({
			fetcher: createFetcher({ success: true, secret: 'secret', backupCodes: [] })
		})
		await expect(invalidClient.enrollMfa()).rejects.toThrow('Invalid authentication response')
	})
})
