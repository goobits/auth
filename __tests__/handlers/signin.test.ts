import { describe, expect, it, vi } from 'vitest'

import { createSigninHandler } from '../../src/handlers/signin.ts'
import { captureRejected, createRequestEvent, getRedirectLocation } from '../testKit.ts'

describe('createSigninHandler', () => {
	it('rejects invalid credentials without setting cookie', async () => {
		const credentialsProvider = {
			authenticate: vi.fn().mockResolvedValue({ user: null, valid: false })
		}
		const sessionAdapter = { createSession: vi.fn(), setSessionCookie: vi.fn() }
		const passwordCredentialAdapter = {}

		const handler = createSigninHandler({
			credentialsProvider,
			passwordCredentialAdapter,
			sessionAdapter
		})
		const result = await handler(
			createRequestEvent({
				url: 'http://localhost/signin',
				method: 'POST',
				form: { email: 'a@b.com', password: 'pw' }
			})
		)

		expect(result.success).toBe(false)
		expect(sessionAdapter.setSessionCookie).not.toHaveBeenCalled()
	})

	it('creates session and redirects on success', async () => {
		const credentialsProvider = {
			authenticate: vi.fn().mockResolvedValue({ user: { id: 'u1' }, valid: true })
		}
		const sessionAdapter = {
			createSession: vi
				.fn()
				.mockResolvedValue({ id: 's1', expiresAt: new Date(Date.now() + 1000) }),
			setSessionCookie: vi.fn()
		}

		const handler = createSigninHandler({
			credentialsProvider,
			passwordCredentialAdapter: {},
			sessionAdapter,
			redirectTo: '/dashboard',
			getSessionMetadata: () => ({ fingerprint: 'fp-1' })
		})

		const error = await captureRejected<{ status?: number; headers?: Headers; location?: string }>(
			handler(
				createRequestEvent({
					url: 'http://localhost/signin',
					method: 'POST',
					form: { email: 'a@b.com', password: 'pw' }
				})
			)
		)
		expect(error.status).toBe(303)
		expect(getRedirectLocation(error)).toBe('/dashboard')

		expect(sessionAdapter.createSession).toHaveBeenCalledWith(
			'u1',
			expect.objectContaining({ rememberMe: false, fingerprint: 'fp-1' })
		)
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled()
	})

	it('keeps security-owned session metadata authoritative', async () => {
		const credentialsProvider = {
			authenticate: vi.fn().mockResolvedValue({ user: { id: 'u1' }, valid: true })
		}
		const sessionAdapter = {
			createSession: vi
				.fn()
				.mockResolvedValue({ id: 's1', expiresAt: new Date(Date.now() + 1000) }),
			setSessionCookie: vi.fn()
		}
		const handler = createSigninHandler({
			credentialsProvider,
			passwordCredentialAdapter: {},
			sessionAdapter,
			redirectTo: '',
			getSessionMetadata: () => ({
				fingerprint: 'fp-1',
				ip: 'attacker-controlled',
				mfaVerifiedAt: new Date(),
				rememberMe: true,
				userAgent: 'attacker-controlled'
			})
		})
		const event = createRequestEvent({
			url: 'http://localhost/signin',
			method: 'POST',
			headers: { 'user-agent': 'trusted-agent' },
			form: { email: 'a@b.com', password: 'pw' }
		})
		event.getClientAddress = () => '127.0.0.1'

		await handler(event)

		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u1', {
			fingerprint: 'fp-1',
			ip: '127.0.0.1',
			rememberMe: false,
			userAgent: 'trusted-agent'
		})
	})

	it('passes configured identifier fields to the credentials provider', async () => {
		const credentialsProvider = {
			authenticate: vi.fn().mockResolvedValue({ user: null, valid: false })
		}
		const sessionAdapter = { createSession: vi.fn(), setSessionCookie: vi.fn() }
		const passwordCredentialAdapter = {}

		const handler = createSigninHandler({
			credentialsProvider,
			passwordCredentialAdapter,
			sessionAdapter,
			fields: { identifier: 'username', password: 'passcode' },
			identifierField: 'username',
			allowBoth: true
		})

		const result = await handler(
			createRequestEvent({
				url: 'http://localhost/signin',
				method: 'POST',
				form: { username: ' LaunchUser ', passcode: 'pw' }
			})
		)

		expect(result.success).toBe(false)
		expect(credentialsProvider.authenticate).toHaveBeenCalledWith({
			identifier: ' LaunchUser ',
			identifierField: 'username',
			allowBoth: true,
			password: 'pw',
			passwordCredentialAdapter
		})
	})

	it('returns an MFA challenge without creating a session', async () => {
		const credentialsProvider = {
			authenticate: vi.fn().mockResolvedValue({
				user: {
					id: 'u1',
					email: 'a@b.com',
					name: 'User',
					avatar: null,
					emailVerified: true
				},
				valid: true
			})
		}
		const sessionAdapter = { createSession: vi.fn(), setSessionCookie: vi.fn() }
		const verificationTokenAdapter = {
			create: vi.fn(),
			deleteByUserAndType: vi.fn(),
			findByToken: vi.fn(),
			deleteById: vi.fn()
		}
		const event = createRequestEvent({
			url: 'http://localhost/signin',
			method: 'POST',
			form: { email: 'a@b.com', password: 'pw' }
		})
		const handler = createSigninHandler({
			credentialsProvider,
			passwordCredentialAdapter: {},
			sessionAdapter,
			redirectTo: '',
			mfa: {
				store: {
					activateEnrollment: vi.fn(),
					beginEnrollment: vi.fn(),
					consumeBackupCode: vi.fn(),
					disableMfa: vi.fn(),
					getBackupCodes: vi.fn(),
					getSecret: vi.fn(),
					getStatus: vi.fn(async () => ({
						enabled: true,
						enabledAt: new Date(),
						backupCodeCount: 8
					}))
				},
				verificationTokenAdapter,
				secureCookies: false
			}
		})

		const result = await handler(event)

		expect(result).toEqual({ success: true, twoFactorRequired: true })
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
		expect(event.cookies.get('goobits_mfa_login')).toBeTruthy()
	})
})
