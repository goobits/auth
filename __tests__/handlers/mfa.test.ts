import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/mfa/totp.ts', () => ({
	generateSecret: vi.fn(() => 'SECRET'),
	createOtpAuthURL: vi.fn(() => 'otpauth://totp/test'),
	verifyTOTP: vi.fn()
}))
vi.mock('../../src/mfa/backupCodes.ts', () => ({
	generateBackupCodes: vi.fn(() => [ 'code1', 'code2' ]),
	hashBackupCodes: vi.fn(async() => [ 'hash1', 'hash2' ]),
	verifyBackupCode: vi.fn()
}))

import {
	beginMfaLoginChallenge,
	createMfaBackupCodeHandler,
	createMfaDisableHandler,
	createMfaEnrollHandler,
	createMfaLoginVerifyHandler,
	createMfaStatusHandler,
	createMfaVerifyHandler
} from '../../src/handlers/mfa.ts'
import * as backup from '../../src/mfa/backupCodes.ts'
import * as totp from '../../src/mfa/totp.ts'
import { createCookies, createRequestEvent } from '../testKit.ts'

function createEvent({ locals = {}, form = {} } = {}) {
	return createRequestEvent({
		url: 'http://localhost/mfa',
		method: 'POST',
		form,
		locals
	})
}

beforeEach(() => {
	vi.mocked(totp.verifyTOTP).mockReset()
	vi.mocked(backup.verifyBackupCode).mockReset()
})

describe('MFA handlers', () => {
	it('enroll requires user', async() => {
		const handler = createMfaEnrollHandler({
			getUserId: () => null,
			store: {},
			issuer: 'Test'
		})
		const result = await handler(createEvent())
		expect(result.success).toBe(false)
	})

	it('enroll stores secret and backup codes', async() => {
		const store = {
			setSecret: vi.fn(),
			setBackupCodes: vi.fn()
		}
		const handler = createMfaEnrollHandler({
			getUserId: () => 'u1',
			store,
			issuer: 'Test'
		})
		const result = await handler(createEvent({ locals: { userId: 'u1' } }))
		expect(result.success).toBe(true)
		expect(store.setSecret).toHaveBeenCalledWith('u1', 'SECRET')
		expect(store.setBackupCodes).toHaveBeenCalledWith('u1', [ 'hash1', 'hash2' ])
	})

	it('status returns adapter-backed enrollment status', async() => {
		const status = {
			backupCodeCount: 2,
			enabled: true,
			enabledAt: new Date('2026-01-01T00:00:00.000Z')
		}
		const store = {
			getBackupCodes: vi.fn(),
			getSecret: vi.fn(),
			getStatus: vi.fn(async() => status)
		}
		const handler = createMfaStatusHandler({ getUserId: () => 'u1', store })
		const result = await handler(createEvent({ locals: { userId: 'u1' } }))

		expect(result).toEqual({ success: true, status })
		expect(store.getStatus).toHaveBeenCalledWith('u1')
	})

	it('verify rejects invalid token', async() => {
		const store = { getSecret: vi.fn(async() => 'SECRET'), enableMfa: vi.fn() }
		vi.mocked(totp.verifyTOTP).mockResolvedValue(false)
		const handler = createMfaVerifyHandler({ getUserId: () => 'u1', store })
		const result = await handler(createEvent({ locals: { userId: 'u1' }, form: { token: '000000' } }))
		expect(result.success).toBe(false)
		expect(store.enableMfa).not.toHaveBeenCalled()
	})

	it('disable requires user', async() => {
		const store = { disableMfa: vi.fn() }
		const handler = createMfaDisableHandler({ getUserId: () => null, store })
		const result = await handler(createEvent())
		expect(result.success).toBe(false)
		expect(store.disableMfa).not.toHaveBeenCalled()
	})

	it('verify rejects missing enrollment secret', async() => {
		const store = { getSecret: vi.fn(async() => null), enableMfa: vi.fn() }
		const handler = createMfaVerifyHandler({ getUserId: () => 'u1', store })
		const result = await handler(createEvent({ locals: { userId: 'u1' }, form: { token: '000000' } }))
		expect(result).toEqual({ success: false, error: 'MFA enrollment not started' })
		expect(store.enableMfa).not.toHaveBeenCalled()
	})

	it('disable invokes store.disableMfa for the authenticated user', async() => {
		const store = { disableMfa: vi.fn(async() => undefined) }
		const handler = createMfaDisableHandler({ getUserId: () => 'u1', store })
		const result = await handler(createEvent({ locals: { userId: 'u1' } }))
		expect(result.success).toBe(true)
		expect(store.disableMfa).toHaveBeenCalledWith('u1')
	})

	it('backup code consumes valid code', async() => {
		vi.mocked(backup.verifyBackupCode).mockResolvedValue({ valid: true, hash: 'h1' })
		const store = {
			getBackupCodes: vi.fn(async() => [ 'h1' ]),
			consumeBackupCode: vi.fn()
		}
		const handler = createMfaBackupCodeHandler({ getUserId: () => 'u1', store })
		const result = await handler(createEvent({ locals: { userId: 'u1' }, form: { code: 'code1' } }))
		expect(result.success).toBe(true)
		expect(store.consumeBackupCode).toHaveBeenCalledWith('u1', 'h1')
	})

	it('creates a session only after a single-use login challenge passes', async() => {
		let tokenRecord: {
			token: {
				id: string;
				token: string;
				type: string;
				expiresAt: Date;
				metadata?: Record<string, unknown>;
			};
			user: Record<string, unknown>;
		} | null = null
		const verificationTokenAdapter = {
			deleteByUserAndType: vi.fn(async() => undefined),
			create: vi.fn(async(input: {
				userId: string;
				type: string;
				token: string;
				expiresAt: Date;
				metadata?: Record<string, unknown>;
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
			}),
			findByToken: vi.fn(async({ token }: { token: string }) =>
				tokenRecord?.token.token === token ? tokenRecord : null
			),
			consumeByToken: vi.fn(async({ token }: { token: string }) => {
				if (tokenRecord?.token.token !== token) return null
				const consumed = tokenRecord
				tokenRecord = null
				return consumed
			}),
			deleteById: vi.fn(async() => undefined)
		}
		const store = {
			getStatus: vi.fn(async() => ({ enabled: true, enabledAt: new Date(), backupCodeCount: 8 })),
			getSecret: vi.fn(async() => 'SECRET'),
			getBackupCodes: vi.fn(async() => []),
			consumeBackupCode: vi.fn(async() => undefined),
			setSecret: vi.fn(),
			setBackupCodes: vi.fn(),
			enableMfa: vi.fn(),
			disableMfa: vi.fn()
		}
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
			config: { store, verificationTokenAdapter, secureCookies: false }
		})

		vi.mocked(totp.verifyTOTP).mockResolvedValue(true)
		const sessionAdapter = {
			createSession: vi.fn(async() => ({ id: 'session-1', expiresAt: new Date(Date.now() + 60_000) })),
			setSessionCookie: vi.fn()
		}
		const verify = createMfaLoginVerifyHandler({
			store,
			verificationTokenAdapter,
			sessionAdapter,
			secureCookies: false
		})
		const result = await verify(createRequestEvent({ cookies, method: 'POST', form: { token: '123456' } }))

		expect(result.success).toBe(true)
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u1', {
			rememberMe: true
		})
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled()
		expect(cookies.get('goobits_mfa_login')).toBeNull()

		const replay = await verify(createRequestEvent({ cookies, method: 'POST', form: { token: '123456' } }))
		expect(replay.success).toBe(false)
		expect(sessionAdapter.createSession).toHaveBeenCalledTimes(1)
	})
})
