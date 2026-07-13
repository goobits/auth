import { describe, expect, it } from 'vitest'

import { generateBackupCodes, hashBackupCodes, verifyBackupCode } from '../../src/mfa/backupCodes.ts'

describe('backup codes', () => {
	it('hashes and verifies codes', async() => {
		const codes = generateBackupCodes({ count: 3, length: 8 })
		const hashes = await hashBackupCodes(codes)
		const result = await verifyBackupCode({ code: codes[1]!, hashedCodes: hashes })
		expect(result.valid).toBe(true)
	})

	it('generates unambiguous fixed-length codes', () => {
		const codes = generateBackupCodes({ count: 5, length: 12 })

		expect(codes).toHaveLength(5)
		expect(new Set(codes).size).toBe(5)
		expect(codes.every((code) => /^[A-HJ-NP-Z2-9]{12}$/.test(code))).toBe(true)
	})

	it('rejects invalid or missing codes', async() => {
		const codes = generateBackupCodes({ count: 2, length: 8 })
		const hashes = await hashBackupCodes(codes)

		await expect(verifyBackupCode({ code: 'WRONG123', hashedCodes: hashes })).resolves.toEqual({
			valid: false
		})
		await expect(verifyBackupCode({ code: codes[0], hashedCodes: [] })).resolves.toEqual({
			valid: false
		})
		await expect(verifyBackupCode({ hashedCodes: hashes })).resolves.toEqual({ valid: false })
	})
})
