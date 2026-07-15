import * as authSecurity from '../../src/security/index.ts'
import * as securityCredentials from '@goobits/security/http-credentials'
import { describe, expect, it } from 'vitest'

describe('HTTP credential package boundary', () => {
	it('keeps generic HTTP credentials in Security instead of Auth', () => {
		expect(securityCredentials.parseBasicAuthHeader).toBeTypeOf('function')
		expect(securityCredentials.parseBearerToken).toBeTypeOf('function')
		expect(securityCredentials.hashApiKey).toBeTypeOf('function')
		expect(authSecurity).not.toHaveProperty('parseBasicAuthHeader')
		expect(authSecurity).not.toHaveProperty('parseBearerToken')
		expect(authSecurity).not.toHaveProperty('hashApiKey')
	})
})
