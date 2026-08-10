import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createRotatingSessionAdapter } from './_mfaTestContext.ts'
import {
	createMfaBackupCodeHandler,
	createMfaDisableHandler,
	createMfaEnrollHandler,
	createMfaStatusHandler,
	createMfaStepUpHandler,
	createMfaVerifyHandler
} from '../../src/handlers/mfaManagement.ts'
import * as backup from '../../src/mfa/backupCodes.ts'
import * as totp from '../../src/mfa/totp.ts'
import { createMfaStore, createRequestEvent } from '../testKit.ts'

function createEvent({ locals = {}, form = {} } = {}) {
	return createRequestEvent({
		url: 'http://localhost/mfa',
		method: 'POST',
		form,
		locals
	})
}

const authorizeSecurityChange = vi.fn(async () => true)

beforeEach(() => {
	vi.mocked(totp.matchTOTP).mockReset()
	vi.mocked(backup.verifyBackupCode).mockReset()
	authorizeSecurityChange.mockClear()
	authorizeSecurityChange.mockResolvedValue(true)
})

describe('MFA management handlers', () => {
	it('enroll requires user', async () => {
		const handler = createMfaEnrollHandler({
			authorizeSecurityChange,
			getUserId: () => null,
			store: createMfaStore(),
			issuer: 'Test'
		})
		const result = await handler(createEvent())
		expect(result.success).toBe(false)
	})

	it('enroll atomically stores a pending secret and backup codes after step-up', async () => {
		const store = createMfaStore()
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
		const store = createMfaStore()
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
		const store = createMfaStore({ getStatus: vi.fn(async () => status) })
		const handler = createMfaStatusHandler({ getUserId: () => 'u1', store })
		const result = await handler(createEvent({ locals: { userId: 'u1' } }))

		expect(result).toEqual({ success: true, status })
		expect(store.getStatus).toHaveBeenCalledWith('u1')
	})

	it('verify rejects invalid token', async () => {
		const store = createMfaStore()
		vi.mocked(totp.matchTOTP).mockResolvedValue(null)
		const handler = createMfaVerifyHandler({ getUserId: () => 'u1', store })
		const result = await handler(
			createEvent({ locals: { userId: 'u1' }, form: { token: '000000' } })
		)
		expect(result.success).toBe(false)
		expect(store.activateEnrollment).not.toHaveBeenCalled()
	})

	it('verify fails closed when a pending enrollment loses the activation race', async () => {
		const store = createMfaStore({ activateEnrollment: vi.fn(async () => false) })
		vi.mocked(totp.matchTOTP).mockResolvedValue({ counter: 100 })
		const handler = createMfaVerifyHandler({ getUserId: () => 'u1', store })

		await expect(
			handler(createEvent({ locals: { userId: 'u1' }, form: { token: '123456' } }))
		).resolves.toEqual({ success: false, error: 'MFA enrollment not started' })
	})

	it('reads the pending secret inside the application mutation boundary', async () => {
		const order: string[] = []
		const store = createMfaStore({
			getSecret: vi.fn(async () => {
				order.push('secret-read')
				return 'JBSWY3DPEHPK3PXP'
			})
		})
		vi.mocked(totp.matchTOTP).mockResolvedValue({ counter: 100 })
		const mutation = vi.fn(async (input) => {
			order.push('mutation-enter')
			return (await input.verify()) ? ('success' as const) : ('invalid-proof' as const)
		})
		const handler = createMfaVerifyHandler({ getUserId: () => 'u1', store, mutation })

		await expect(
			handler(createEvent({ locals: { userId: 'u1' }, form: { token: '123456' } }))
		).resolves.toEqual({ success: true })
		expect(order).toEqual(['mutation-enter', 'secret-read'])
	})

	it('runs application lifecycle hooks only after factor state changes succeed', async () => {
		const store = createMfaStore()
		const onEnabled = vi.fn()
		const onDisabled = vi.fn()
		vi.mocked(totp.matchTOTP).mockResolvedValue({ counter: 100 })
		const verifyEvent = createEvent({
			locals: { userId: 'u1' },
			form: { token: '123456' }
		})
		await expect(
			createMfaVerifyHandler({
				getUserId: () => 'u1',
				store,
				hooks: { onEnabled }
			})(verifyEvent)
		).resolves.toEqual({ success: true })
		expect(onEnabled).toHaveBeenCalledWith({ userId: 'u1', event: verifyEvent })

		const disableEvent = createEvent({
			locals: { userId: 'u1' },
			form: { token: '123456' }
		})
		await expect(
			createMfaDisableHandler({
				authorizeSecurityChange,
				getUserId: () => 'u1',
				store,
				hooks: { onDisabled }
			})(disableEvent)
		).resolves.toEqual({ success: true })
		expect(onDisabled).toHaveBeenCalledWith({ userId: 'u1', event: disableEvent })
	})

	it('disable requires user', async () => {
		const store = createMfaStore()
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
		const store = createMfaStore({ getSecret: vi.fn(async () => null) })
		const handler = createMfaVerifyHandler({ getUserId: () => 'u1', store })
		const result = await handler(
			createEvent({ locals: { userId: 'u1' }, form: { token: '000000' } })
		)
		expect(result).toEqual({ success: false, error: 'MFA enrollment not started' })
		expect(store.activateEnrollment).not.toHaveBeenCalled()
	})

	it('disable requires step-up and an active factor code', async () => {
		const store = createMfaStore()
		vi.mocked(totp.matchTOTP).mockResolvedValue({ counter: 100 })
		const consumingAuthorization = vi.fn(async ({ request }: { request: Request }) => {
			await request.formData()
			return true
		})
		const handler = createMfaDisableHandler({
			authorizeSecurityChange: consumingAuthorization,
			getUserId: () => 'u1',
			store
		})
		const result = await handler(
			createEvent({ locals: { userId: 'u1' }, form: { token: '123456' } })
		)
		expect(result.success).toBe(true)
		expect(consumingAuthorization).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'mfa.disable', userId: 'u1' })
		)
		expect(store.disableMfa).toHaveBeenCalledWith('u1')
	})

	it('disable fails closed when step-up is denied or the factor code is invalid', async () => {
		const store = createMfaStore()
		const handler = createMfaDisableHandler({
			authorizeSecurityChange,
			getUserId: () => 'u1',
			store
		})

		authorizeSecurityChange.mockResolvedValueOnce(false)
		await expect(handler(createEvent({ locals: { userId: 'u1' } }))).resolves.toEqual({
			success: false,
			error: 'Reauthentication required'
		})
		expect(store.getSecret).not.toHaveBeenCalled()

		vi.mocked(totp.matchTOTP).mockResolvedValueOnce(null)
		await expect(
			handler(createEvent({ locals: { userId: 'u1' }, form: { token: '000000' } }))
		).resolves.toEqual({ success: false, error: 'Invalid authentication code' })
		expect(store.disableMfa).not.toHaveBeenCalled()
	})

	it('disable accepts a backup code only when its atomic consume succeeds', async () => {
		vi.mocked(backup.verifyBackupCode).mockResolvedValue({ valid: true, hash: 'h1' })
		const store = createMfaStore({
			consumeBackupCode: vi.fn(async () => false),
			getBackupCodes: vi.fn(async () => ['h1'])
		})
		const handler = createMfaDisableHandler({
			authorizeSecurityChange,
			getUserId: () => 'u1',
			store
		})

		await expect(
			handler(createEvent({ locals: { userId: 'u1' }, form: { backupCode: 'backup' } }))
		).resolves.toEqual({ success: false, error: 'Invalid authentication code' })
		expect(store.disableMfa).not.toHaveBeenCalled()
	})

	it('backup code consumes valid code', async () => {
		vi.mocked(backup.verifyBackupCode).mockResolvedValue({ valid: true, hash: 'h1' })
		const store = createMfaStore({
			getBackupCodes: vi.fn(async () => ['h1'])
		})
		const handler = createMfaBackupCodeHandler({ getUserId: () => 'u1', store })
		const result = await handler(createEvent({ locals: { userId: 'u1' }, form: { code: 'code1' } }))
		expect(result.success).toBe(true)
		expect(store.consumeBackupCode).toHaveBeenCalledWith('u1', 'h1')
	})

	it('rejects a backup code that loses the atomic consume race', async () => {
		vi.mocked(backup.verifyBackupCode).mockResolvedValue({ valid: true, hash: 'h1' })
		const store = createMfaStore({
			consumeBackupCode: vi.fn(async () => false),
			getBackupCodes: vi.fn(async () => ['h1'])
		})
		const handler = createMfaBackupCodeHandler({ getUserId: () => 'u1', store })

		await expect(
			handler(createEvent({ locals: { userId: 'u1' }, form: { code: 'code1' } }))
		).resolves.toEqual({ success: false, error: 'Invalid backup code' })
	})

	it('rotates the session after step-up while preserving primary-authentication time', async () => {
		const primaryAuthenticatedAt = new Date('2026-07-15T10:00:00.000Z')
		const store = createMfaStore()
		vi.mocked(totp.matchTOTP).mockResolvedValue({ counter: 100 })
		const sessionAdapter = createRotatingSessionAdapter()
		const handler = createMfaStepUpHandler({
			getUserId: () => 'u1',
			store,
			sessionAdapter
		})
		const event = createEvent({
			locals: {
				user: { id: 'u1' },
				session: {
					id: 'original-session',
					userId: 'u1',
					expiresAt: new Date(Date.now() + 60_000),
					createdAt: primaryAuthenticatedAt,
					ip: '192.0.2.10'
				}
			},
			form: { token: '123456' }
		})

		await expect(handler(event)).resolves.toMatchObject({
			success: true,
			mfaVerifiedAt: expect.any(Date)
		})
		expect(sessionAdapter.createSession).toHaveBeenCalledWith(
			'u1',
			expect.objectContaining({
				createdAt: primaryAuthenticatedAt,
				mfaVerifiedAt: expect.any(Date),
				ip: '192.0.2.10'
			})
		)
		expect(sessionAdapter.invalidateSession).toHaveBeenCalledWith('original-session')
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalledWith(
			event.cookies,
			expect.objectContaining({ id: 'replacement-session' })
		)
	})

	it('rotates the session after enrollment activation', async () => {
		const primaryAuthenticatedAt = new Date('2026-07-15T10:00:00.000Z')
		const store = createMfaStore()
		vi.mocked(totp.matchTOTP).mockResolvedValue({ counter: 100 })
		const sessionAdapter = createRotatingSessionAdapter()
		const handler = createMfaVerifyHandler({
			getUserId: () => 'u1',
			store,
			sessionAdapter
		})
		const event = createEvent({
			locals: {
				user: { id: 'u1' },
				session: {
					id: 'original-session',
					userId: 'u1',
					expiresAt: new Date(Date.now() + 60_000),
					createdAt: primaryAuthenticatedAt
				}
			},
			form: { token: '123456' }
		})

		await expect(handler(event)).resolves.toMatchObject({
			success: true,
			mfaVerifiedAt: expect.any(Date)
		})
		expect(store.activateEnrollment).toHaveBeenCalledWith('u1', 100)
		expect(sessionAdapter.createSession).toHaveBeenCalledWith(
			'u1',
			expect.objectContaining({
				createdAt: primaryAuthenticatedAt,
				mfaVerifiedAt: expect.any(Date)
			})
		)
		expect(sessionAdapter.invalidateSession).toHaveBeenCalledWith('original-session')
	})
})
