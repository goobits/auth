import { describe, it, expect } from 'vitest'
import { generateBackupCodes, hashBackupCodes, verifyBackupCode } from '../../src/mfa/backup-codes.ts'

describe('backup codes', () => {
	it('hashes and verifies codes', async () => {
		const codes = generateBackupCodes({ count: 3, length: 8 })
		const hashes = await hashBackupCodes(codes)
		const result = await verifyBackupCode({ code: codes[1]!, hashedCodes: hashes })
		expect(result.valid).toBe(true)
	})
})
