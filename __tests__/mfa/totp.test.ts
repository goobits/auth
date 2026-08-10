import { describe, expect, it } from 'vitest'

import {
	createOtpAuthURL,
	generateSecret,
	generateTOTP,
	matchTOTP,
	verifyTOTP
} from '../../src/mfa/totp.ts'

describe('totp', () => {
	it('generates and verifies token', async () => {
		const secret = generateSecret()
		const token = await generateTOTP({ secret, time: 1700000000000 })
		const ok = await verifyTOTP({ secret, token, time: 1700000000000 })
		expect(ok).toBe(true)
		await expect(matchTOTP({ secret, token, time: 1700000000000 })).resolves.toEqual({
			counter: Math.floor(1700000000000 / 1000 / 30)
		})
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
		await expect(matchTOTP({ secret, token, time: 1700000000000, window: 1 })).resolves.toEqual({
			counter: Math.floor((1700000000000 - 30_000) / 1000 / 30)
		})
		await expect(verifyTOTP({ secret, token, time: 1700000000000, window: 0 })).resolves.toBe(false)
	})

	it.each([-1, 1.5, 11, Number.NaN, Number.POSITIVE_INFINITY])(
		'rejects an unsafe verification window: %s',
		async (window) => {
			const secret = generateSecret()
			await expect(verifyTOTP({ secret, token: '123456', window })).rejects.toThrow(
				'TOTP window must be an integer'
			)
		}
	)

	it('rejects malformed tokens before verification', async () => {
		const secret = generateSecret()
		await expect(verifyTOTP({ secret, token: '12345' })).resolves.toBe(false)
		await expect(verifyTOTP({ secret, token: '12345x' })).resolves.toBe(false)
	})

	it('rejects unsafe generation parameters', async () => {
		const secret = generateSecret()
		await expect(generateTOTP({ secret, digits: 0 })).rejects.toThrow('TOTP digits')
		await expect(generateTOTP({ secret, period: 0 })).rejects.toThrow('TOTP period')
		await expect(generateTOTP({ secret, time: Number.POSITIVE_INFINITY })).rejects.toThrow(
			'TOTP time'
		)
	})

	it('builds an otpauth URL for authenticator apps', () => {
		const url = createOtpAuthURL({
			secret: 'ABC123',
			label: 'example.test:hello@example.test',
			issuer: 'example.test'
		})

		expect(url).toContain('otpauth://totp/example.test%3Ahello%40example.test?')
		expect(url).toContain('secret=ABC123')
		expect(url).toContain('issuer=example.test')
	})
})
