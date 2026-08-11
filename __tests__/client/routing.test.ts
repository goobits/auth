import { describe, expect, it, vi } from 'vitest'

import { createAuthClient } from '../../src/client/index.ts'
import { createFetcher, createQueuedFetcher } from './_testKit.ts'

describe('auth client routing and transport', () => {
	it('uses the shared CSRF fetch pipeline for unsafe same-origin requests', async () => {
		const fetcher = createFetcher()
		const client = createAuthClient({
			baseUrl: 'https://app.example',
			csrf: {
				baseUrl: 'https://app.example/account',
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
			baseUrl: 'https://app.example',
			csrf: {
				baseUrl: 'https://app.example/account',
				readToken: () => 'csrf-token'
			},
			fetcher
		})
		await sameOriginClient.listSessions()

		const crossOriginClient = createAuthClient({
			baseUrl: 'https://api.example.test',
			csrf: {
				baseUrl: 'https://app.example/account',
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
		const client = createAuthClient({ fetcher, headers: { 'x-app': 'example-app' } })

		await client.sendMagicLink({ email: 'member@example.com' })
		await client.verifyMagicLink({ token: 'token' })
		await client.stepUpMfa({ token: '123456' })

		expect(vi.mocked(fetcher).mock.calls.map(([url]) => String(url))).toEqual([
			'/auth/magic-link',
			'/auth/magic-link/verify',
			'/auth/mfa/step-up'
		])
		for (const [, init] of vi.mocked(fetcher).mock.calls) {
			expect(new Headers(init?.headers).get('x-app')).toBe('example-app')
		}
	})

	it('honors endpoint overrides and validates OAuth provider input', async () => {
		const fetcher = createQueuedFetcher([{ ok: true, sessions: [] }, { ok: true }])
		const client = createAuthClient({
			baseUrl: 'https://app.example',
			fetcher,
			endpoints: {
				sessions: '/account/sessions',
				sessionRevoke: '/account/sessions/revoke'
			}
		})

		await client.listSessions()
		await client.revokeSession({ all: true })

		expect(vi.mocked(fetcher).mock.calls.map(([url]) => String(url))).toEqual([
			'https://app.example/account/sessions',
			'https://app.example/account/sessions/revoke'
		])
		expect(client.loginWithOAuth('google')).toBe('https://app.example/auth/signin/google')
		expect(client.loginWithOAuth('google', '/library?view=recent')).toBe(
			'https://app.example/auth/signin/google?returnTo=%2Flibrary%3Fview%3Drecent'
		)
		expect(client.linkOAuth('apple', '/settings/security')).toBe(
			'https://app.example/auth/link/apple?returnTo=%2Fsettings%2Fsecurity'
		)
		expect(client.reauthenticateWithOAuth('google')).toBe('https://app.example/auth/reauth/google')
		expect(() => client.loginWithOAuth('')).toThrow('Invalid OAuth provider')
	})

	it('uses the configured facade base path for API and OAuth routes', async () => {
		const fetcher = createFetcher({ ok: true, sessions: [] })
		const client = createAuthClient({
			baseUrl: 'https://app.example',
			basePath: '/account/identity/',
			fetcher
		})

		await client.listSessions()
		expect(client.loginWithOAuth('google')).toBe(
			'https://app.example/account/identity/signin/google'
		)
		expect(vi.mocked(fetcher).mock.calls[0]?.[0]).toBe(
			'https://app.example/account/identity/sessions'
		)
		expect(() => createAuthClient({ basePath: '//attacker.example' })).toThrow(
			'Invalid auth base path'
		)
		expect(() => createAuthClient({ basePath: '/auth/%2e%2e/account' })).toThrow(
			'Invalid auth base path'
		)
	})
})
