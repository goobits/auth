import { describe, expect, it } from 'vitest'

import { sanitizeUser } from '../../src/utils/sanitize.ts'

describe('sanitizeUser', () => {
	it('recursively removes normalized secret fields', () => {
		const user = {
			id: 'u1',
			password: 'secret',
			passwordHash: 'encoded',
			token: 'tok',
			email: 'a@b.com',
			settings: { refresh_token: 'refresh', theme: 'dark' }
		}
		const safe = sanitizeUser(user)
		if (!safe) throw new Error('Expected sanitized user')
		expect(safe.password).toBeUndefined()
		expect(safe.passwordHash).toBeUndefined()
		expect(safe.token).toBeUndefined()
		expect(safe.email).toBe('a@b.com')
		expect(safe.settings).toEqual({ theme: 'dark' })
	})
})
