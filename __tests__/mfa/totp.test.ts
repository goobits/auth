import { describe, expect, it } from 'vitest'

import { createOtpAuthURL, generateSecret, generateTOTP, verifyTOTP } from '../../src/mfa/totp.ts'

describe('totp', () => {
	it('generates and verifies token', async () => {
		const secret = generateSecret()
		const token = await generateTOTP({ secret, time: 1700000000000 })
		const ok = await verifyTOTP({ secret, token, time: 1700000000000 })
		expect(ok).toBe(true)
	})

	it('rejects wrong or missing tokens', async () => {
		const secret = generateSecret()

		await expect(verifyTOTP({ secret, token: '000000', time: 1700000000000 })).resolves.toBe(false)
		await expect(verifyTOTP({ secret, token: '', time: 1700000000000 })).resolves.toBe(false)
		await expect(generateTOTP({ secret: '', time: 1700000000000 })).rejects.toThrow(
			'TOTP secret is required'
		)
	})

	it('honors the verification window', async () => {
		const secret = generateSecret()
		const token = await generateTOTP({ secret, time: 1700000000000 - 30_000 })

		await expect(verifyTOTP({ secret, token, time: 1700000000000, window: 1 })).resolves.toBe(true)
		await expect(verifyTOTP({ secret, token, time: 1700000000000, window: 0 })).resolves.toBe(false)
	})

	it('builds an otpauth URL for authenticator apps', () => {
		const url = createOtpAuthURL({
			secret: 'ABC123',
			label: 'pdx.fun:hello@pdx.fun',
			issuer: 'pdx.fun'
		})

		expect(url).toContain('otpauth://totp/pdx.fun%3Ahello%40pdx.fun?')
		expect(url).toContain('secret=ABC123')
		expect(url).toContain('issuer=pdx.fun')
	})
})
