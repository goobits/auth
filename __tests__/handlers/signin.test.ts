import { describe, it, expect, vi } from 'vitest'
import { createSigninHandler } from '../../src/handlers/signin.ts'

function createCookies() {
	const store = new Map<string, { value: string; options: Record<string, unknown> }>()
	return {
		set: (name: string, value: string, options: Record<string, unknown>) => store.set(name, { value, options }),
		get: (name: string) => store.get(name)?.value ?? null,
		delete: (name: string) => store.delete(name),
		_store: store
	}
}

function createEvent({ email = 'a@b.com', password = 'pw' } = {}) {
	return {
		cookies: createCookies(),
		request: new Request('http://localhost/signin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ email, password })
		}),
		locals: {}
	}
}

function getRedirectLocation(err: { location?: string; headers?: Headers } | null) {
	return err?.location || err?.headers?.get?.('location')
}

describe('createSigninHandler', () => {
	it('rejects invalid credentials without setting cookie', async () => {
		const credentialsProvider = { authenticate: vi.fn().mockResolvedValue({ user: null, valid: false }) }
		const sessionAdapter = { createSession: vi.fn(), setSessionCookie: vi.fn() }
		const userAdapter = {}

		const handler = createSigninHandler({ credentialsProvider, userAdapter, sessionAdapter })
		const result = await handler(createEvent())

		expect(result.success).toBe(false)
		expect(sessionAdapter.setSessionCookie).not.toHaveBeenCalled()
	})

	it('creates session and redirects on success', async () => {
		const credentialsProvider = { authenticate: vi.fn().mockResolvedValue({ user: { id: 'u1' }, valid: true }) }
		const sessionAdapter = {
			createSession: vi.fn().mockResolvedValue({ id: 's1', expiresAt: new Date(Date.now() + 1000) }),
			setSessionCookie: vi.fn()
		}

		const handler = createSigninHandler({
			credentialsProvider,
			userAdapter: {},
			sessionAdapter,
			redirectTo: '/dashboard'
		})

		try {
			await handler(createEvent())
		} catch (err) {
			const error = err as { status?: number; headers?: Headers; location?: string }
			expect(error.status).toBe(303)
			expect(getRedirectLocation(error)).toBe('/dashboard')
		}

		expect(sessionAdapter.createSession).toHaveBeenCalledWith(
			'u1',
			expect.objectContaining({ rememberMe: false })
		)
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled()
	})
})
