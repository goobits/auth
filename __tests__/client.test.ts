import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAuthClient } from '../src/client/index.ts'

function jsonResponse(body: unknown) {
	return new Response(JSON.stringify(body), {
		headers: { 'content-type': 'application/json' }
	})
}

function createFetcher(body: unknown = { success: true, ok: true, sessions: [] }) {
	return vi.fn(async () => jsonResponse(body)) as unknown as typeof fetch
}

function createQueuedFetcher(bodies: unknown[]) {
	let index = 0
	return vi.fn(async () => {
		if (index >= bodies.length) throw new Error('Unexpected auth client request')
		const body = bodies[index]
		index += 1
		return jsonResponse(body)
	}) as unknown as typeof fetch
}

describe('auth client', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

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
		expect(client.loginWithOAuth('google')).toBe('https://app.example/auth/google')
		expect(() => client.loginWithOAuth('')).toThrow('Provider is required')
	})

	it('converts WebAuthn options and credentials at the browser boundary', async () => {
		const createCredential = vi.fn(async () => ({
			id: 'register-credential',
			type: 'public-key',
			rawId: new Uint8Array([7, 8]),
			response: {
				attestationObject: new Uint8Array([9]),
				clientDataJSON: new Uint8Array([10]),
				getTransports: () => ['internal']
			}
		}))
		const getCredential = vi.fn(async () => ({
			id: 'login-credential',
			type: 'public-key',
			rawId: new Uint8Array([14]),
			response: {
				authenticatorData: new Uint8Array([11]),
				clientDataJSON: new Uint8Array([10]),
				signature: new Uint8Array([12]),
				userHandle: new Uint8Array([13])
			}
		}))
		vi.stubGlobal('navigator', {
			credentials: { create: createCredential, get: getCredential }
		})
		const fetcher = createQueuedFetcher([
			{
				challengeId: 'register-challenge',
				options: {
					challenge: 'AQI',
					user: { id: 'AwQ', name: 'member@example.com', displayName: 'Member' },
					excludeCredentials: [{ id: 'BQY', type: 'public-key' }]
				}
			},
			{ ok: true },
			{
				challengeId: 'login-challenge',
				options: {
					challenge: 'Dw',
					allowCredentials: [{ id: 'EBE', type: 'public-key' }]
				}
			},
			{ ok: true }
		])
		const client = createAuthClient({ fetcher })

		await expect(client.registerPasskey({ name: 'Example app key' })).resolves.toEqual({
			success: true
		})
		await expect(client.loginWithPasskey()).resolves.toEqual({ success: true })

		const createOptions = createCredential.mock.calls[0]?.[0]?.publicKey
		expect(Array.from(createOptions?.challenge as Uint8Array)).toEqual([1, 2])
		expect(Array.from(createOptions?.user.id as Uint8Array)).toEqual([3, 4])
		expect(Array.from(createOptions?.excludeCredentials?.[0]?.id as Uint8Array)).toEqual([5, 6])
		const requestOptions = getCredential.mock.calls[0]?.[0]?.publicKey
		expect(Array.from(requestOptions?.challenge as Uint8Array)).toEqual([15])
		expect(Array.from(requestOptions?.allowCredentials?.[0]?.id as Uint8Array)).toEqual([16, 17])

		const registerBody = JSON.parse(String(vi.mocked(fetcher).mock.calls[1]?.[1]?.body)) as Record<
			string,
			unknown
		>
		expect(registerBody).toEqual({
			challengeId: 'register-challenge',
			credential: {
				id: 'register-credential',
				type: 'public-key',
				rawId: 'Bwg',
				response: {
					attestationObject: 'CQ',
					clientDataJSON: 'Cg',
					transports: ['internal']
				}
			},
			name: 'Example app key'
		})
		const loginBody = JSON.parse(String(vi.mocked(fetcher).mock.calls[3]?.[1]?.body)) as Record<
			string,
			unknown
		>
		expect(loginBody).toEqual({
			challengeId: 'login-challenge',
			credential: {
				id: 'login-credential',
				type: 'public-key',
				rawId: 'Dg',
				response: {
					authenticatorData: 'Cw',
					clientDataJSON: 'Cg',
					signature: 'DA',
					userHandle: 'DQ'
				}
			}
		})
		expect(vi.mocked(fetcher).mock.calls[2]?.[1]?.body).toBeUndefined()
	})

	it('returns passkey option failures without opening a browser ceremony', async () => {
		const createCredential = vi.fn()
		const getCredential = vi.fn()
		vi.stubGlobal('navigator', {
			credentials: { create: createCredential, get: getCredential }
		})
		const client = createAuthClient({
			fetcher: createQueuedFetcher([
				{ ok: false, error: 'Reauthentication required' },
				{ ok: false, error: 'Passkey login unavailable' }
			])
		})

		await expect(client.registerPasskey({ currentPassword: 'wrong-password' })).resolves.toEqual({
			success: false,
			error: 'Reauthentication required'
		})
		await expect(client.loginWithPasskey()).resolves.toEqual({
			success: false,
			error: 'Passkey login unavailable'
		})
		expect(createCredential).not.toHaveBeenCalled()
		expect(getCredential).not.toHaveBeenCalled()
	})

	it('lists and removes passkeys through the owner-scoped management endpoint', async () => {
		const fetcher = createQueuedFetcher([
			{
				ok: true,
				credentials: [
					{
						credentialId: 'credential-1',
						name: 'Laptop',
						transports: ['internal'],
						createdAt: '2026-07-27T00:00:00.000Z',
						lastUsedAt: null
					}
				]
			},
			{ ok: true }
		])
		const client = createAuthClient({ fetcher })

		await expect(client.listPasskeys()).resolves.toEqual({
			success: true,
			credentials: [
				{
					credentialId: 'credential-1',
					name: 'Laptop',
					transports: ['internal'],
					createdAt: '2026-07-27T00:00:00.000Z',
					lastUsedAt: null
				}
			]
		})
		await expect(
			client.removePasskey({
				credentialId: 'credential-1',
				currentPassword: 'current-password'
			})
		).resolves.toEqual({ success: true })

		expect(vi.mocked(fetcher).mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual(
			[
				['/auth/passkey/credentials', 'GET'],
				['/auth/passkey/credentials', 'POST']
			]
		)
		expect(
			Object.fromEntries((vi.mocked(fetcher).mock.calls[1]?.[1]?.body as FormData).entries())
		).toEqual({
			credentialId: 'credential-1',
			currentPassword: 'current-password'
		})
	})

	it('uses a browser passkey for session step-up', async () => {
		const getCredential = vi.fn(async () => ({
			id: 'step-up-credential',
			type: 'public-key',
			rawId: new Uint8Array([1]),
			response: {
				authenticatorData: new Uint8Array([2]),
				clientDataJSON: new Uint8Array([3]),
				signature: new Uint8Array([4]),
				userHandle: new Uint8Array([5])
			}
		}))
		vi.stubGlobal('navigator', { credentials: { get: getCredential } })
		const fetcher = createQueuedFetcher([
			{ challengeId: 'step-up-challenge', options: { challenge: 'AQ' } },
			{ ok: true, mfaVerifiedAt: '2026-07-27T00:01:00.000Z' }
		])
		const client = createAuthClient({ fetcher })

		await expect(client.stepUpWithPasskey()).resolves.toEqual({
			success: true,
			mfaVerifiedAt: '2026-07-27T00:01:00.000Z'
		})
		expect(vi.mocked(fetcher).mock.calls.map(([url]) => String(url))).toEqual([
			'/auth/passkey/step-up/options',
			'/auth/passkey/step-up/verify'
		])
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
