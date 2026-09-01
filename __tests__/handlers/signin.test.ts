import { describe, expect, it, vi } from 'vitest'

import { createSigninHandler } from '../../src/handlers/signin.ts'
import { captureRejected, createRequestEvent, getRedirectLocation } from '../testKit.ts'

describe('createSigninHandler', () => {
	it('requires owned guards or an explicit outer security boundary', () => {
		const baseConfig = {
			credentialsProvider: { authenticate: vi.fn() },
			passwordCredentialAdapter: {},
			sessionAdapter: {
				createSession: vi.fn(),
				validateSession: vi.fn(),
				invalidateSession: vi.fn(),
				invalidateUserSessions: vi.fn(),
				listSessions: vi.fn()
			}
		}

		expect(() => createSigninHandler(baseConfig)).toThrow(/requires CSRF and rate-limit/)
		expect(() =>
			createSigninHandler({
				...baseConfig,
				csrf: { validate: async () => true },
				rateLimit: { check: async () => ({ allowed: true }) }
			})
		).not.toThrow()
	})

	it('rejects invalid credentials without setting cookie', async () => {
		const credentialsProvider = {
			authenticate: vi.fn().mockResolvedValue({ user: null, valid: false })
		}
		const sessionAdapter = { createSession: vi.fn(), setSessionCookie: vi.fn() }
		const passwordCredentialAdapter = {}

		const handler = createSigninHandler({
			validateExternalSecurityBoundary: async () => true,
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

	it('executes and fails closed on a delegated request boundary', async () => {
		const authenticate = vi.fn()
		const validateExternalSecurityBoundary = vi.fn(async () => false)
		const handler = createSigninHandler({
			credentialsProvider: { authenticate },
			passwordCredentialAdapter: {},
			sessionAdapter: { createSession: vi.fn(), setSessionCookie: vi.fn() },
			validateExternalSecurityBoundary
		})
		const event = createRequestEvent({
			url: 'http://localhost/signin',
			method: 'POST',
			form: { email: 'a@b.com', password: 'pw' }
		})

		await expect(handler(event)).resolves.toEqual({
			error: 'Invalid security boundary',
			success: false
		})
		expect(validateExternalSecurityBoundary).toHaveBeenCalledWith(event)
		expect(authenticate).not.toHaveBeenCalled()
	})

	it('creates session and redirects on success', async () => {
		const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
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
			validateExternalSecurityBoundary: async () => true,
			credentialsProvider,
			passwordCredentialAdapter: {},
			sessionAdapter,
			redirectTo: '/dashboard',
			getSessionMetadata: () => ({ fingerprint: 'fp-1' }),
			logger
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
		expect(logger.error).not.toHaveBeenCalled()
	})

	it('provides request context to the existing hook and honors a typed denial', async () => {
		const user = { id: 'u1', email: 'a@b.com', emailVerified: false }
		const onSignin = vi.fn().mockResolvedValue({
			allowed: false,
			error: 'Verify your email before signing in',
			code: 'email_unverified',
			status: 403
		})
		const sessionAdapter = { createSession: vi.fn(), setSessionCookie: vi.fn() }
		const handler = createSigninHandler({
			validateExternalSecurityBoundary: async () => true,
			credentialsProvider: {
				authenticate: vi.fn().mockResolvedValue({ user, valid: true })
			},
			passwordCredentialAdapter: {},
			sessionAdapter,
			redirectTo: '',
			onSignin
		})
		const event = createRequestEvent({
			url: 'http://localhost/signin',
			method: 'POST',
			form: { email: 'a@b.com', password: 'pw', invite: 'invite-a', remember: 'on' }
		})

		const result = await handler(event)

		expect(result).toEqual({
			error: 'Verify your email before signing in',
			success: false,
			code: 'email_unverified',
			status: 403
		})
		expect(onSignin).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'u1' }),
			expect.objectContaining({
				event,
				rememberMe: true,
				sessionMetadata: expect.objectContaining({ rememberMe: true })
			})
		)
		expect(onSignin.mock.calls[0]?.[1].formData.get('invite')).toBe('invite-a')
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
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
			validateExternalSecurityBoundary: async () => true,
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
			validateExternalSecurityBoundary: async () => true,
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
			replaceForUserAndType: vi.fn(),
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
			validateExternalSecurityBoundary: async () => true,
			credentialsProvider,
			passwordCredentialAdapter: {},
			sessionAdapter,
			redirectTo: '',
			mfa: {
				store: {
					activateEnrollment: vi.fn(),
					beginEnrollment: vi.fn(),
					consumeBackupCode: vi.fn(),
					consumeTotpCounter: vi.fn(),
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

	it('runs application authorization before creating an MFA challenge', async () => {
		const authorizeSignin = vi.fn().mockResolvedValue({
			allowed: false,
			error: 'Verify your email before signing in',
			code: 'email_unverified',
			status: 403
		})
		const verificationTokenAdapter = {
			create: vi.fn(),
			replaceForUserAndType: vi.fn(),
			deleteByUserAndType: vi.fn(),
			findByToken: vi.fn(),
			deleteById: vi.fn()
		}
		const sessionAdapter = { createSession: vi.fn(), setSessionCookie: vi.fn() }
		const handler = createSigninHandler({
			validateExternalSecurityBoundary: async () => true,
			credentialsProvider: {
				authenticate: vi.fn().mockResolvedValue({
					user: {
						id: 'u1',
						email: 'a@b.com',
						name: 'User',
						avatar: null,
						emailVerified: false
					},
					valid: true
				})
			},
			passwordCredentialAdapter: {},
			sessionAdapter,
			redirectTo: '',
			authorizeSignin,
			mfa: {
				store: {
					activateEnrollment: vi.fn(),
					beginEnrollment: vi.fn(),
					consumeBackupCode: vi.fn(),
					consumeTotpCounter: vi.fn(),
					disableMfa: vi.fn(),
					getBackupCodes: vi.fn(),
					getSecret: vi.fn(),
					getStatus: vi.fn(async () => ({
						enabled: true,
						enabledAt: new Date(),
						backupCodeCount: 8
					}))
				},
				verificationTokenAdapter
			}
		})

		await expect(
			handler(
				createRequestEvent({
					url: 'http://localhost/signin',
					method: 'POST',
					form: { email: 'a@b.com', password: 'pw' }
				})
			)
		).resolves.toEqual({
			error: 'Verify your email before signing in',
			success: false,
			code: 'email_unverified',
			status: 403
		})
		expect(authorizeSignin).toHaveBeenCalledOnce()
		expect(verificationTokenAdapter.create).not.toHaveBeenCalled()
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
	})
})
