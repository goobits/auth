import { describe, it, expect, vi } from 'vitest'
import { KVSessionAdapter } from '../../src/adapters/session/kv.ts'

function createNamespace() {
	const store = new Map<string, string>()
	return {
		get: async (key: string, opts?: { type?: string }) => {
			const raw = store.get(key)
			if (!raw) return null
			return opts?.type === 'json' ? JSON.parse(raw) : raw
		},
		put: async (key: string, value: string) => { store.set(key, value) },
		delete: async (key: string) => { store.delete(key) },
		list: async ({ prefix }: { prefix?: string }) => {
			const keys: { name: string }[] = []
			for (const key of store.keys()) {
				if (!prefix || key.startsWith(prefix)) {
					keys.push({ name: key })
				}
			}
			return { keys }
		},
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
		expect(validated).toBeTruthy()
		expect(validated!.fresh).toBe(true)
		expect(validated!.expiresAt.getTime()).toBeGreaterThan(700)
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

	it('lists sessions for a user when list is available', async () => {
		const namespace = createNamespace()
		const adapter = new KVSessionAdapter(namespace)
		const s1 = await adapter.createSession('u1')
		await adapter.createSession('u2')
		const sessions = await adapter.listSessions('u1')
		expect(sessions).toHaveLength(1)
		expect(sessions[0]!.id).toBe(s1.id)
	})
})
