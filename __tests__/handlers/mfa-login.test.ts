import { beforeEach, describe, expect, it, vi } from 'vitest'

import './_mfaTestContext.ts'
import { beginMfaLoginChallenge, createMfaLoginVerifyHandler } from '../../src/handlers/mfaLogin.ts'
import * as totp from '../../src/mfa/totp.ts'
import { createCookies, createMfaStore, createRequestEvent } from '../testKit.ts'

beforeEach(() => vi.mocked(totp.matchTOTP).mockReset())

describe('MFA login handlers', () => {
	it('creates a session only after a single-use login challenge passes', async () => {
		let tokenRecord: {
			token: {
				id: string
				token: string
				type: string
				expiresAt: Date
				metadata?: Record<string, unknown>
			}
			user: Record<string, unknown>
		} | null = null
		const verificationTokenAdapter = {
			deleteByUserAndType: vi.fn(async () => undefined),
			create: vi.fn(async () => undefined),
			replaceForUserAndType: vi.fn(
				async (input: {
					userId: string
					type: string
					token: string
					expiresAt: Date
					metadata?: Record<string, unknown>
				}) => {
					tokenRecord = {
						token: {
							id: 'challenge-1',
							token: input.token,
							type: input.type,
							expiresAt: input.expiresAt,
							...(input.metadata ? { metadata: input.metadata } : {})
						},
						user: { id: input.userId, email: 'user@example.com' }
					}
				}
			),
			findByToken: vi.fn(async ({ token }: { token: string }) =>
				tokenRecord?.token.token === token ? tokenRecord : null
			),
			consumeByToken: vi.fn(async ({ token }: { token: string }) => {
				if (tokenRecord?.token.token !== token) return null
				const consumed = tokenRecord
				tokenRecord = null
				return consumed
			}),
			deleteById: vi.fn(async () => undefined)
		}
		const store = createMfaStore()
		const cookies = createCookies()
		await beginMfaLoginChallenge({
			event: createRequestEvent({ cookies }),
			user: {
				id: 'u1',
				email: 'user@example.com',
				name: 'User',
				avatar: null,
				emailVerified: true
			},
			sessionMetadata: { rememberMe: true },
			redirectTo: '/library',
			config: { store, verificationTokenAdapter, secureCookies: false }
		})

		vi.mocked(totp.matchTOTP).mockResolvedValue({ counter: 100 })
		const sessionAdapter = {
			createSession: vi.fn(async () => ({
				id: 'session-1',
				expiresAt: new Date(Date.now() + 60_000)
			})),
			setSessionCookie: vi.fn()
		}
		const beforeVerify = vi.fn()
		const onSuccess = vi.fn()
		const onVerified = vi.fn(async () => {
			expect(store.consumeTotpCounter).not.toHaveBeenCalled()
		})
		const verify = createMfaLoginVerifyHandler({
			store,
			verificationTokenAdapter,
			sessionAdapter,
			secureCookies: false,
			validateExternalSecurityBoundary: async () => true,
			attemptPolicy: { beforeVerify, onSuccess },
			onVerified
		})
		const result = await verify(
			createRequestEvent({ cookies, method: 'POST', form: { token: '123456' } })
		)

		expect(result).toMatchObject({ success: true, redirectTo: '/library' })
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u1', {
			rememberMe: true,
			mfaVerifiedAt: expect.any(Date)
		})
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled()
		expect(store.consumeTotpCounter).toHaveBeenCalledWith('u1', 100)
		expect(beforeVerify).toHaveBeenCalledWith(
			expect.objectContaining({ challengeId: 'challenge-1', userId: 'u1' })
		)
		expect(onVerified).toHaveBeenCalledTimes(1)
		expect(onSuccess).toHaveBeenCalledTimes(1)
		expect(cookies.get('goobits_mfa_login')).toBeNull()

		const replay = await verify(
			createRequestEvent({ cookies, method: 'POST', form: { token: '123456' } })
		)
		expect(replay.success).toBe(false)
		expect(sessionAdapter.createSession).toHaveBeenCalledTimes(1)
	})

	it('requires an explicit standalone request-security boundary', () => {
		expect(() =>
			createMfaLoginVerifyHandler({
				store: createMfaStore(),
				verificationTokenAdapter: {} as never,
				sessionAdapter: {} as never
			})
		).toThrow(/CSRF and rate-limit guards, or validateExternalSecurityBoundary/)
	})

	it('delegates challenge, proof, and session persistence to one optional transaction port', async () => {
		const cookies = createCookies({ goobits_mfa_login: 'challenge-token' })
		const record = {
			token: {
				id: 'challenge-1',
				token: 'stored-token-hash',
				type: 'mfa_login',
				expiresAt: new Date(Date.now() + 60_000),
				metadata: { rememberMe: true, redirectTo: '/library' }
			},
			user: { id: 'u1', email: 'user@example.com' }
		}
		const verificationTokenAdapter = {
			findByToken: vi.fn(async () => record),
			consumeByToken: vi.fn(),
			deleteById: vi.fn(),
			deleteByUserAndType: vi.fn(),
			create: vi.fn(),
			replaceForUserAndType: vi.fn()
		}
		const store = createMfaStore()
		const session = {
			id: 'session-1',
			userId: 'u1',
			expiresAt: new Date(Date.now() + 60_000)
		}
		const completeLogin = vi.fn(async () => session)
		const sessionAdapter = { createSession: vi.fn(), setSessionCookie: vi.fn() }
		vi.mocked(totp.matchTOTP).mockResolvedValue({ counter: 100 })
		const verify = createMfaLoginVerifyHandler({
			store,
			verificationTokenAdapter,
			sessionAdapter,
			completeLogin,
			validateExternalSecurityBoundary: async () => true
		})

		await expect(
			verify(createRequestEvent({ cookies, method: 'POST', form: { token: '123456' } }))
		).resolves.toMatchObject({ success: true, redirectTo: '/library' })
		expect(completeLogin).toHaveBeenCalledWith({
			challengeId: 'challenge-1',
			userId: 'u1',
			proof: { method: 'totp', counter: 100 },
			sessionMetadata: { rememberMe: true, mfaVerifiedAt: expect.any(Date) }
		})
		expect(store.consumeTotpCounter).not.toHaveBeenCalled()
		expect(verificationTokenAdapter.consumeByToken).not.toHaveBeenCalled()
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalledWith(cookies, session)
		expect(cookies.get('goobits_mfa_login')).toBeNull()
	})
})
