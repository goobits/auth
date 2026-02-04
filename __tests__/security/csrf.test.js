import { describe, it, expect, vi } from 'vitest'
import { issueCsrfToken, validateCsrfRequest, MemoryCsrfStore } from '../../src/security/csrf.js'

function createCookies() {
	const store = new Map()
	return {
		set: (name, value, options) => store.set(name, { value, options }),
		get: (name) => store.get(name)?.value ?? null,
		delete: (name) => store.delete(name),
		_store: store
	}
}

describe('csrf', () => {
	it('issues token and validates matching header', async () => {
		const cookies = createCookies()
		const store = new MemoryCsrfStore()
		const token = await issueCsrfToken({ cookies, store, ttlMs: 1000, secure: false })

		const request = new Request('http://localhost', {
			headers: { 'x-csrf-token': token }
		})
		const valid = await validateCsrfRequest({ request, cookies, store, checkExpiry: true })
		expect(valid).toBe(true)
	})

	it('rejects mismatched token', async () => {
		const cookies = createCookies()
		cookies.set('csrf-token', 'good')
		const request = new Request('http://localhost', { headers: { 'x-csrf-token': 'bad' } })
		const valid = await validateCsrfRequest({ request, cookies })
		expect(valid).toBe(false)
	})
})
