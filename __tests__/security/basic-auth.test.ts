import { describe, expect, it, vi } from 'vitest'

import {
	createBasicAuthResponse,
	parseBasicAuthHeader,
	verifyBasicAuthHeader
} from '../../src/security/basicAuth.ts'

function basic(username: string, password: string): string {
	return `Basic ${ Buffer.from(`${ username }:${ password }`).toString('base64') }`
}

describe('basic auth', () => {
	it('parses valid Basic credentials', () => {
		expect(parseBasicAuthHeader(basic('sketch', 'secret'))).toEqual({
			username: 'sketch',
			password: 'secret'
		})
	})

	it('rejects missing and malformed headers', () => {
		expect(parseBasicAuthHeader(null)).toBeNull()
		expect(parseBasicAuthHeader('Bearer token')).toBeNull()
		expect(parseBasicAuthHeader('Basic')).toBeNull()
		expect(parseBasicAuthHeader('Basic !!!invalid-base64!!!')).toBeNull()
		expect(parseBasicAuthHeader(`Basic ${ Buffer.from('missing-separator').toString('base64') }`)).toBeNull()
	})

	it('verifies credentials with a supplied hash resolver and verifier', async() => {
		const verifyPassword = vi.fn(async(storedHash: string, password: string) => {
			return storedHash === 'hash:secret' && password === 'secret'
		})

		await expect(
			verifyBasicAuthHeader({
				authHeader: basic('sketch', 'secret'),
				getPasswordHash: username => (username === 'sketch' ? 'hash:secret' : null),
				verifyPassword
			})
		).resolves.toBe('sketch')
		expect(verifyPassword).toHaveBeenCalledWith('hash:secret', 'secret')
	})

	it('returns null when the user is unknown or password verification fails', async() => {
		await expect(
			verifyBasicAuthHeader({
				authHeader: basic('unknown', 'secret'),
				getPasswordHash: () => null,
				verifyPassword: async() => true
			})
		).resolves.toBeNull()

		await expect(
			verifyBasicAuthHeader({
				authHeader: basic('sketch', 'wrong'),
				getPasswordHash: () => 'hash:secret',
				verifyPassword: async() => false
			})
		).resolves.toBeNull()
	})

	it('creates a Basic challenge response', () => {
		const response = createBasicAuthResponse({ realm: 'Asset "Manager"\\Admin\r\n' })
		expect(response.status).toBe(401)
		expect(response.headers.get('WWW-Authenticate')).toBe('Basic realm="Asset \\"Manager\\"\\\\Admin"')
	})
})
