import { describe, it, expect } from 'vitest'
import { redactObject } from '../../src/utils/redact.ts'

type RedactedOutput = {
	password: string;
	profile: { token: string; nested: Array<{ Access_Token: string }> };
	ok: boolean;
}

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
		const output = redactObject(input) as RedactedOutput
		expect(output.password).toBe('[redacted]')
		expect(output.profile.token).toBe('[redacted]')
		expect(output.profile.nested[0].Access_Token).toBe('[redacted]')
		expect(output.ok).toBe(true)
	})

	it('redacts newly added sensitive keys', () => {
		const input = {
			api_key: 'sensitive',
			apiKey: 'sensitive',
			client_secret: 'sensitive',
			clientSecret: 'sensitive',
			verification_token: 'sensitive',
			totp: '123456',
			passphrase: 'correct horse battery staple'
		}
		const output = redactObject(input) as any
		expect(output.api_key).toBe('[redacted]')
		expect(output.apiKey).toBe('[redacted]')
		expect(output.client_secret).toBe('[redacted]')
		expect(output.clientSecret).toBe('[redacted]')
		expect(output.verification_token).toBe('[redacted]')
		expect(output.totp).toBe('[redacted]')
		expect(output.passphrase).toBe('[redacted]')
	})
})
