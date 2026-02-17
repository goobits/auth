import { describe, it, expect } from 'vitest'
import { generateSecret, generateTOTP, verifyTOTP } from '../../src/mfa/totp.ts'

describe('totp', () => {
	it('generates and verifies token', async () => {
		const secret = generateSecret()
		const token = await generateTOTP({ secret, time: 1700000000000 })
		const ok = await verifyTOTP({ secret, token, time: 1700000000000 })
		expect(ok).toBe(true)
	})
})
