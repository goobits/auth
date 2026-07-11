import { describe, expect, it } from 'vitest'

import { issueCsrfToken, MemoryCsrfStore, validateCsrfRequest } from '../../src/security/csrf.ts'
import { createCookies } from '../testKit.ts'

describe('csrf', () => {
	it('issues token and validates matching header', async() => {
		const cookies = createCookies()
		const store = new MemoryCsrfStore()
		const token = await issueCsrfToken({ cookies, store, ttlMs: 1000, secure: false })

		const request = new Request('http://localhost', {
			headers: { 'x-csrf-token': token }
		})
		const valid = await validateCsrfRequest({ request, cookies, store, checkExpiry: true })
		expect(valid).toBe(true)
		expect(cookies._store.get('csrf-token')?.options.httpOnly).toBe(false)
	})

	it('allows callers to issue httpOnly csrf cookies when they provide another token channel', async() => {
		const cookies = createCookies()
		await issueCsrfToken({ cookies, secure: false, httpOnly: true })
		expect(cookies._store.get('csrf-token')?.options.httpOnly).toBe(true)
	})

	it('rejects mismatched token', async() => {
		const cookies = createCookies()
		cookies.set('csrf-token', 'good')
		const request = new Request('http://localhost', { headers: { 'x-csrf-token': 'bad' } })
		const valid = await validateCsrfRequest({ request, cookies })
		expect(valid).toBe(false)
	})
})
