import { describe, expect, test } from 'vitest'

import { renderQrCodeSvg } from '../../src/qr/index.ts'

describe('renderQrCodeSvg', () => {
	test('renders an SVG QR code without embedding the source value', () => {
		const svg = renderQrCodeSvg({
			value: 'otpauth://totp/Goobits:user@example.test?secret=SHAREDSECRET'
		})

		expect(svg).toContain('<svg')
		expect(svg).toContain('viewBox')
		expect(svg).toContain('aria-hidden="true"')
		expect(svg).toContain('focusable="false"')
		expect(svg).not.toContain('SHAREDSECRET')
	})

	test('validates empty values and rendering dimensions', () => {
		expect(() => renderQrCodeSvg({ value: '' })).toThrow('QR code value is required')
		expect(() => renderQrCodeSvg({ value: 'hello', border: -1 })).toThrow(
			'QR code border must be an integer from 0 to 16'
		)
		expect(() => renderQrCodeSvg({ value: 'hello', pixelSize: 0 })).toThrow(
			'QR code pixel size must be an integer from 1 to 32'
		)
	})
})
