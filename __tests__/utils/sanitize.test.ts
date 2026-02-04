import { describe, it, expect } from 'vitest'
import { sanitizeUser } from '../../src/utils/sanitize.ts'


describe('sanitizeUser', () => {
	it('removes password and token fields', () => {
		const user = { id: 'u1', password: 'secret', token: 'tok', email: 'a@b.com' }
		const safe = sanitizeUser(user)
		if (!safe) throw new Error('Expected sanitized user')
		expect(safe.password).toBeUndefined()
		expect(safe.token).toBeUndefined()
		expect(safe.email).toBe('a@b.com')
	})
})
