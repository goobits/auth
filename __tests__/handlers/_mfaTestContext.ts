import { vi } from 'vitest'

vi.mock('../../src/mfa/totp.ts', () => ({
	generateSecret: vi.fn(() => 'SECRET'),
	createOtpAuthURL: vi.fn(() => 'otpauth://totp/test'),
	matchTOTP: vi.fn()
}))

vi.mock('../../src/mfa/backupCodes.ts', () => ({
	generateBackupCodes: vi.fn(() => ['code1', 'code2']),
	hashBackupCodes: vi.fn(async () => ['hash1', 'hash2']),
	verifyBackupCode: vi.fn()
}))

export function createRotatingSessionAdapter() {
	return {
		createSession: vi.fn(async (userId: string, metadata = {}) => ({
			id: 'replacement-session',
			userId,
			expiresAt: new Date(Date.now() + 60_000),
			...metadata
		})),
		invalidateSession: vi.fn(async () => undefined),
		setSessionCookie: vi.fn()
	}
}
