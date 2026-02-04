import { describe, it, expect } from 'vitest'
import { redactObject } from '../../src/utils/redact.js'


describe('redactObject', () => {
	it('redacts nested sensitive keys case-insensitively', () => {
		const input = {
			password: 'secret',
			profile: {
				token: 'abc',
				nested: [{ Access_Token: 'def' }]
			},
			ok: true
		}
		const output = redactObject(input)
		expect(output.password).toBe('[redacted]')
		expect(output.profile.token).toBe('[redacted]')
		expect(output.profile.nested[0].Access_Token).toBe('[redacted]')
		expect(output.ok).toBe(true)
	})
})
