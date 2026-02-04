import { describe, it, expect, vi } from 'vitest'
import { createSignupHandler } from '../../src/handlers/signup.ts'

function createCookies() {
	const store = new Map<string, { value: string; options: Record<string, unknown> }>()
	return {
		set: (name: string, value: string, options: Record<string, unknown>) => store.set(name, { value, options }),
		get: (name: string) => store.get(name)?.value ?? null,
		delete: (name: string) => store.delete(name),
		_store: store
	}
}

function createEvent({ email = 'a@b.com', password = 'pw', name = 'A' } = {}) {
	return {
		cookies: createCookies(),
		request: new Request('http://localhost/signup', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ email, password, name })
		}),
		locals: {}
	}
}

function getRedirectLocation(err: { location?: string; headers?: Headers } | null) {
	return err?.location || err?.headers?.get?.('location')
}

describe('createSignupHandler', () => {
	it('rejects if email already exists', async () => {
		const userAdapter = { getUserByEmail: vi.fn().mockResolvedValue({ id: 'u1' }) }
		const credentialsProvider = { signUp: vi.fn() }
		const sessionAdapter = { createSession: vi.fn(), setSessionCookie: vi.fn() }

		const handler = createSignupHandler({ credentialsProvider, userAdapter, sessionAdapter })
		const result = await handler(createEvent())

		expect(result.success).toBe(false)
		expect(credentialsProvider.signUp).not.toHaveBeenCalled()
	})

	it('continues signup if verification email fails', async () => {
		const userAdapter = {
			getUserByEmail: vi.fn().mockResolvedValue(null)
		}
		const credentialsProvider = {
			signUp: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' })
		}
		const sessionAdapter = {
			createSession: vi.fn().mockResolvedValue({ id: 's1', expiresAt: new Date(Date.now() + 1000) }),
			setSessionCookie: vi.fn()
		}
		const verificationTokenAdapter = {
			deleteByUserAndType: vi.fn(),
			create: vi.fn(),
			findByToken: vi.fn(),
			deleteById: vi.fn()
		}

		const handler = createSignupHandler({
			credentialsProvider,
			userAdapter,
			sessionAdapter,
			verificationTokenAdapter,
			sendVerificationEmail: vi.fn().mockRejectedValue(new Error('smtp down')),
			redirectTo: '/welcome'
		})

		try {
			await handler(createEvent())
		} catch (err) {
			const error = err as { status?: number; headers?: Headers; location?: string }
			expect(error.status).toBe(303)
			expect(getRedirectLocation(error)).toBe('/welcome')
		}

		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled()
	})
})
