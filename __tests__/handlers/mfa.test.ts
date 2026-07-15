import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/mfa/totp.ts', () => ({
	generateSecret: vi.fn(() => 'SECRET'),
	createOtpAuthURL: vi.fn(() => 'otpauth://totp/test'),
	verifyTOTP: vi.fn()
}))
vi.mock('../../src/mfa/backupCodes.ts', () => ({
	generateBackupCodes: vi.fn(() => ['code1', 'code2']),
	hashBackupCodes: vi.fn(async () => ['hash1', 'hash2']),
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
import type { MfaStore } from '../../src/handlers/mfa.ts'
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

const authorizeSecurityChange = vi.fn(async () => true)

function createStore(overrides: Partial<MfaStore> = {}): MfaStore {
	return {
		activateEnrollment: vi.fn(async () => true),
		beginEnrollment: vi.fn(async () => true),
		consumeBackupCode: vi.fn(async () => true),
		disableMfa: vi.fn(async () => true),
		getBackupCodes: vi.fn(async () => []),
		getSecret: vi.fn(async () => 'SECRET'),
		getStatus: vi.fn(async () => ({
			backupCodeCount: 8,
			enabled: true,
			enabledAt: new Date()
		})),
		...overrides
	}
}

beforeEach(() => {
	vi.mocked(totp.verifyTOTP).mockReset()
	vi.mocked(backup.verifyBackupCode).mockReset()
	authorizeSecurityChange.mockClear()
	authorizeSecurityChange.mockResolvedValue(true)
})

describe('MFA handlers', () => {
	it('enroll requires user', async () => {
		const handler = createMfaEnrollHandler({
			authorizeSecurityChange,
			getUserId: () => null,
			store: createStore(),
			issuer: 'Test'
		})
		const result = await handler(createEvent())
		expect(result.success).toBe(false)
	})

	it('enroll atomically stores a pending secret and backup codes after step-up', async () => {
		const store = createStore()
		const handler = createMfaEnrollHandler({
			authorizeSecurityChange,
			getUserId: () => 'u1',
			store,
			issuer: 'Test'
		})
		const result = await handler(createEvent({ locals: { userId: 'u1' } }))
		expect(result.success).toBe(true)
		expect(authorizeSecurityChange).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'mfa.enroll', userId: 'u1' })
		)
		expect(store.beginEnrollment).toHaveBeenCalledWith('u1', 'SECRET', ['hash1', 'hash2'])
	})

	it('enroll fails closed when step-up is denied or an active factor wins the race', async () => {
		const store = createStore()
		authorizeSecurityChange.mockResolvedValueOnce(false)
		const denied = createMfaEnrollHandler({
			authorizeSecurityChange,
			getUserId: () => 'u1',
			store
		})
		await expect(denied(createEvent())).resolves.toEqual({
			success: false,
			error: 'Reauthentication required'
		})
		expect(store.beginEnrollment).not.toHaveBeenCalled()

		vi.mocked(store.beginEnrollment).mockResolvedValueOnce(false)
		await expect(denied(createEvent())).resolves.toEqual({
			success: false,
			error: 'Multi-factor authentication is already enabled'
		})
	})

	it('status returns adapter-backed enrollment status', async () => {
		const status = {
			backupCodeCount: 2,
			enabled: true,
			enabledAt: new Date('2026-01-01T00:00:00.000Z')
		}
		const store = createStore({ getStatus: vi.fn(async () => status) })
		const handler = createMfaStatusHandler({ getUserId: () => 'u1', store })
		const result = await handler(createEvent({ locals: { userId: 'u1' } }))

		expect(result).toEqual({ success: true, status })
		expect(store.getStatus).toHaveBeenCalledWith('u1')
	})

	it('verify rejects invalid token', async () => {
		const store = createStore()
		vi.mocked(totp.verifyTOTP).mockResolvedValue(false)
		const handler = createMfaVerifyHandler({ getUserId: () => 'u1', store })
		const result = await handler(
			createEvent({ locals: { userId: 'u1' }, form: { token: '000000' } })
		)
		expect(result.success).toBe(false)
		expect(store.activateEnrollment).not.toHaveBeenCalled()
	})

	it('disable requires user', async () => {
		const store = createStore()
		const handler = createMfaDisableHandler({
			authorizeSecurityChange,
			getUserId: () => null,
			store
		})
		const result = await handler(createEvent())
		expect(result.success).toBe(false)
		expect(store.disableMfa).not.toHaveBeenCalled()
	})

	it('verify rejects missing enrollment secret', async () => {
		const store = createStore({ getSecret: vi.fn(async () => null) })
		const handler = createMfaVerifyHandler({ getUserId: () => 'u1', store })
		const result = await handler(
			createEvent({ locals: { userId: 'u1' }, form: { token: '000000' } })
		)
		expect(result).toEqual({ success: false, error: 'MFA enrollment not started' })
		expect(store.activateEnrollment).not.toHaveBeenCalled()
	})

	it('disable requires step-up and an active factor code', async () => {
		const store = createStore()
		vi.mocked(totp.verifyTOTP).mockResolvedValue(true)
		const handler = createMfaDisableHandler({
			authorizeSecurityChange,
			getUserId: () => 'u1',
			store
		})
		const result = await handler(
			createEvent({ locals: { userId: 'u1' }, form: { token: '123456' } })
		)
		expect(result.success).toBe(true)
		expect(authorizeSecurityChange).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'mfa.disable', userId: 'u1' })
		)
		expect(store.disableMfa).toHaveBeenCalledWith('u1')
	})

	it('backup code consumes valid code', async () => {
		vi.mocked(backup.verifyBackupCode).mockResolvedValue({ valid: true, hash: 'h1' })
		const store = createStore({
			getBackupCodes: vi.fn(async () => ['h1'])
		})
		const handler = createMfaBackupCodeHandler({ getUserId: () => 'u1', store })
		const result = await handler(createEvent({ locals: { userId: 'u1' }, form: { code: 'code1' } }))
		expect(result.success).toBe(true)
		expect(store.consumeBackupCode).toHaveBeenCalledWith('u1', 'h1')
	})

	it('rejects a backup code that loses the atomic consume race', async () => {
		vi.mocked(backup.verifyBackupCode).mockResolvedValue({ valid: true, hash: 'h1' })
		const store = createStore({
			consumeBackupCode: vi.fn(async () => false),
			getBackupCodes: vi.fn(async () => ['h1'])
		})
		const handler = createMfaBackupCodeHandler({ getUserId: () => 'u1', store })

		await expect(
			handler(createEvent({ locals: { userId: 'u1' }, form: { code: 'code1' } }))
		).resolves.toEqual({ success: false, error: 'Invalid backup code' })
	})

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
			create: vi.fn(
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
		const store = createStore()
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
			createSession: vi.fn(async () => ({
				id: 'session-1',
				expiresAt: new Date(Date.now() + 60_000)
			})),
			setSessionCookie: vi.fn()
		}
		const verify = createMfaLoginVerifyHandler({
			store,
			verificationTokenAdapter,
			sessionAdapter,
			secureCookies: false
		})
		const result = await verify(
			createRequestEvent({ cookies, method: 'POST', form: { token: '123456' } })
		)

		expect(result.success).toBe(true)
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u1', {
			rememberMe: true,
			mfaVerifiedAt: expect.any(Date)
		})
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled()
		expect(cookies.get('goobits_mfa_login')).toBeNull()

		const replay = await verify(
			createRequestEvent({ cookies, method: 'POST', form: { token: '123456' } })
		)
		expect(replay.success).toBe(false)
		expect(sessionAdapter.createSession).toHaveBeenCalledTimes(1)
	})
})
