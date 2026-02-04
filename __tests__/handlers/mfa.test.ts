import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/mfa/totp.ts', () => ({
	generateSecret: vi.fn(() => 'SECRET'),
	createOtpAuthURL: vi.fn(() => 'otpauth://totp/test'),
	verifyTOTP: vi.fn()
}))
vi.mock('../../src/mfa/backup-codes.ts', () => ({
	generateBackupCodes: vi.fn(() => ['code1', 'code2']),
	hashBackupCodes: vi.fn(async () => ['hash1', 'hash2']),
	verifyBackupCode: vi.fn()
}))

import * as totp from '../../src/mfa/totp.ts'
import * as backup from '../../src/mfa/backup-codes.ts'
import { createMfaEnrollHandler, createMfaVerifyHandler, createMfaBackupCodeHandler } from '../../src/handlers/mfa.ts'

function createEvent({ locals = {}, form = {} } = {}) {
	return {
		locals,
		request: new Request('http://localhost/mfa', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(form)
		})
	}
}

beforeEach(() => {
	vi.mocked(totp.verifyTOTP).mockReset()
	vi.mocked(backup.verifyBackupCode).mockReset()
})

describe('MFA handlers', () => {
	it('enroll requires user', async () => {
		const handler = createMfaEnrollHandler({
			getUserId: () => null,
			store: {},
			issuer: 'Test'
		})
		const result = await handler(createEvent())
		expect(result.success).toBe(false)
	})

	it('enroll stores secret and backup codes', async () => {
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
		expect(store.setBackupCodes).toHaveBeenCalledWith('u1', ['hash1', 'hash2'])
	})

	it('verify rejects invalid token', async () => {
		const store = { getSecret: vi.fn(async () => 'SECRET'), enableMfa: vi.fn() }
		vi.mocked(totp.verifyTOTP).mockResolvedValue(false)
		const handler = createMfaVerifyHandler({ getUserId: () => 'u1', store })
		const result = await handler(createEvent({ locals: { userId: 'u1' }, form: { token: '000000' } }))
		expect(result.success).toBe(false)
		expect(store.enableMfa).not.toHaveBeenCalled()
	})

	it('backup code consumes valid code', async () => {
		vi.mocked(backup.verifyBackupCode).mockResolvedValue({ valid: true, hash: 'h1' })
		const store = {
			getBackupCodes: vi.fn(async () => ['h1']),
			consumeBackupCode: vi.fn()
		}
		const handler = createMfaBackupCodeHandler({ getUserId: () => 'u1', store })
		const result = await handler(createEvent({ locals: { userId: 'u1' }, form: { code: 'code1' } }))
		expect(result.success).toBe(true)
		expect(store.consumeBackupCode).toHaveBeenCalledWith('u1', 'h1')
	})
})
