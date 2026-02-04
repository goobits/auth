import { describe, it, expect, vi } from 'vitest'
import { KVSessionAdapter } from '../../src/adapters/session/kv.js'

function createNamespace() {
	const store = new Map()
	return {
		get: async (key, opts) => {
			const raw = store.get(key)
			if (!raw) return null
			return opts?.type === 'json' ? JSON.parse(raw) : raw
		},
		put: async (key, value) => { store.set(key, value) },
		delete: async (key) => { store.delete(key) },
		_store: store
	}
}

describe('KVSessionAdapter', () => {
	it('refreshes near expiry and marks session fresh', async () => {
		const namespace = createNamespace()
		const adapter = new KVSessionAdapter(namespace, {
			sessionLifetime: 1000,
			sessionRefreshThreshold: 400
		})

		vi.spyOn(Date, 'now').mockReturnValue(0)
		const session = await adapter.createSession('u1')

		vi.spyOn(Date, 'now').mockReturnValue(700)
		const { session: validated } = await adapter.validateSession(session.id)
		expect(validated.fresh).toBe(true)
		expect(validated.expiresAt.getTime()).toBeGreaterThan(700)
	})

	it('deletes expired sessions', async () => {
		const namespace = createNamespace()
		const adapter = new KVSessionAdapter(namespace, { sessionLifetime: 10 })
		vi.spyOn(Date, 'now').mockReturnValue(0)
		const session = await adapter.createSession('u1')

		vi.spyOn(Date, 'now').mockReturnValue(20)
		const result = await adapter.validateSession(session.id)
		expect(result.session).toBeNull()
	})
})
