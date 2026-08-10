import { describe, expect, it, vi } from 'vitest'

import { createAuthClient } from '../../src/client/index.ts'
import { createFetcher, createQueuedFetcher } from './_testKit.ts'

describe('auth client account security', () => {
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

	it('carries current-password proof through factor-management requests', async () => {
		const fetcher = createQueuedFetcher([
			{
				success: true,
				secret: 'secret',
				otpauthUrl: 'otpauth://totp/example',
				backupCodes: ['backup-1']
			},
			{ success: true }
		])
		const client = createAuthClient({ fetcher })

		await client.enrollMfa({ currentPassword: 'current-password' })
		await client.disableMfa({
			token: '123456',
			currentPassword: 'current-password'
		})

		expect(
			Object.fromEntries((vi.mocked(fetcher).mock.calls[0]?.[1]?.body as FormData).entries())
		).toEqual({ currentPassword: 'current-password' })
		expect(
			Object.fromEntries((vi.mocked(fetcher).mock.calls[1]?.[1]?.body as FormData).entries())
		).toEqual({ token: '123456', currentPassword: 'current-password' })
	})

	it('preserves the request contract for every non-WebAuthn operation', async () => {
		const fetcher = createQueuedFetcher([
			{ success: true },
			{ success: true },
			{
				success: true,
				status: { enabled: true, enabledAt: '2026-07-19T00:00:00.000Z', backupCodeCount: 7 }
			},
			{
				success: true,
				secret: 'secret',
				otpauthUrl: 'otpauth://totp/example-app',
				backupCodes: ['backup-1']
			},
			{ success: true, mfaVerifiedAt: '2026-07-19T00:01:00.000Z' },
			{ success: true },
			{ success: true },
			{ success: true },
			{
				ok: true,
				sessions: [
					{
						id: 'session-1',
						userId: 'user-1',
						expiresAt: '2026-07-20T00:00:00.000Z',
						createdAt: null,
						lastActiveAt: null,
						ip: null,
						userAgent: null,
						current: true
					}
				]
			},
			{ ok: true }
		])
		const client = createAuthClient({
			baseUrl: 'https://app.example',
			fetcher,
			headers: { 'x-app': 'example-app' }
		})

		await client.sendMagicLink({
			email: 'member@example.com',
			redirectTo: '/library'
		})
		await client.verifyMagicLink({ token: 'magic-token', email: 'member@example.com' })
		await client.getMfaStatus()
		await client.enrollMfa()
		await client.verifyMfa({ token: '123456' })
		await client.disableMfa({ backupCode: 'disable-code' })
		await client.stepUpMfa({ token: '654321' })
		await client.useMfaBackupCode({ code: 'backup-code' })
		await client.listSessions()
		await client.revokeSession({ sessionId: 'session-1', others: true })

		const calls = vi.mocked(fetcher).mock.calls
		expect(calls.map(([url, init]) => [String(url), init?.method])).toEqual([
			['https://app.example/auth/magic-link', 'POST'],
			['https://app.example/auth/magic-link/verify', 'POST'],
			['https://app.example/auth/mfa/status', 'GET'],
			['https://app.example/auth/mfa/enroll', 'POST'],
			['https://app.example/auth/mfa/verify', 'POST'],
			['https://app.example/auth/mfa/disable', 'POST'],
			['https://app.example/auth/mfa/step-up', 'POST'],
			['https://app.example/auth/mfa/backup-code', 'POST'],
			['https://app.example/auth/sessions', 'GET'],
			['https://app.example/auth/sessions', 'POST']
		])
		expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({
			email: 'member@example.com',
			redirectTo: '/library'
		})
		expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({
			token: 'magic-token',
			email: 'member@example.com'
		})
		expect(Object.fromEntries((calls[4]?.[1]?.body as FormData).entries())).toEqual({
			token: '123456'
		})
		expect(Object.fromEntries((calls[5]?.[1]?.body as FormData).entries())).toEqual({
			backupCode: 'disable-code'
		})
		expect(Object.fromEntries((calls[6]?.[1]?.body as FormData).entries())).toEqual({
			token: '654321'
		})
		expect(Object.fromEntries((calls[7]?.[1]?.body as FormData).entries())).toEqual({
			code: 'backup-code'
		})
		expect(JSON.parse(String(calls[9]?.[1]?.body))).toEqual({
			sessionId: 'session-1',
			others: true
		})
		for (const [, init] of calls) {
			expect(new Headers(init?.headers).get('x-app')).toBe('example-app')
		}
	})

	it('lists and unlinks OAuth identities through the owner-scoped endpoints', async () => {
		const fetcher = createQueuedFetcher([
			{ ok: true, providers: ['apple', 'google'] },
			{ ok: true }
		])
		const client = createAuthClient({ fetcher })

		await expect(client.listOAuthIdentities()).resolves.toEqual({
			ok: true,
			providers: ['apple', 'google']
		})
		await expect(client.unlinkOAuthIdentity('google')).resolves.toEqual({ ok: true })

		expect(vi.mocked(fetcher).mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual(
			[
				['/auth/oauth/identities', 'GET'],
				['/auth/oauth/unlink', 'POST']
			]
		)
		expect(
			Object.fromEntries((vi.mocked(fetcher).mock.calls[1]?.[1]?.body as FormData).entries())
		).toEqual({ provider: 'google' })
	})
	it.each([
		{
			name: 'MFA status',
			body: {
				success: true,
				status: { enabled: 'yes', enabledAt: null, backupCodeCount: 0 }
			},
			invoke: (client: ReturnType<typeof createAuthClient>) => client.getMfaStatus()
		},
		{
			name: 'MFA action',
			body: { success: true, mfaVerifiedAt: 123 },
			invoke: (client: ReturnType<typeof createAuthClient>) => client.verifyMfa({ token: '123456' })
		},
		{
			name: 'session list',
			body: { ok: true, sessions: [{ id: 'incomplete' }] },
			invoke: (client: ReturnType<typeof createAuthClient>) => client.listSessions()
		},
		{
			name: 'session action',
			body: { success: true },
			invoke: (client: ReturnType<typeof createAuthClient>) => client.revokeSession({ all: true })
		}
	])('rejects malformed $name responses', async ({ body, invoke }) => {
		await expect(invoke(createAuthClient({ fetcher: createFetcher(body) }))).rejects.toThrow(
			'Invalid authentication response'
		)
	})

	it('preserves structured failures from the server', async () => {
		const client = createAuthClient({
			fetcher: createFetcher({
				success: false,
				error: 'Step-up required',
				code: 'MFA_REQUIRED',
				status: 403
			})
		})

		await expect(client.getMfaStatus()).resolves.toEqual({
			success: false,
			error: 'Step-up required',
			code: 'MFA_REQUIRED',
			status: 403
		})
	})
})
