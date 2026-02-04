import { describe, it, expect, vi } from 'vitest'
import { createAuth } from '../src/createAuth.ts'

function createCookies() {
	const store = new Map<string, { value: string; options: Record<string, unknown> }>()
	return {
		get: (name: string) => store.get(name)?.value ?? null,
		set: (name: string, value: string, options: Record<string, unknown> = {}) => store.set(name, { value, options }),
		delete: (name: string) => store.delete(name),
		_store: store
	}
}

function createEvent() {
	return {
		cookies: createCookies(),
		locals: {} as Record<string, unknown>,
		params: {},
		url: new URL('http://localhost/')
	}
}

function createSessionAdapter({ cookieName = 'session', validateResult }: { cookieName?: string; validateResult?: any } = {}) {
	return {
		cookieName,
		validateSession: vi.fn(async () => validateResult),
		setSessionCookie: vi.fn(),
		deleteSessionCookie: vi.fn()
	}
}

describe('createAuth', () => {
	it('throws when required config is missing', () => {
		expect(() => createAuth({ adapters: {}, providers: { google: { provider: {} } } }))
			.toThrow('createAuth requires adapters.session')
	})

	it('allows auth without OAuth providers', () => {
		const auth = createAuth({ adapters: { session: {} as any } }) as any
		expect(auth.handlers.login).toBeUndefined()
		expect(auth.handlers.callback).toBeUndefined()
	})

	it('clears cookie when session is invalid', async () => {
		const sessionAdapter = createSessionAdapter({
			cookieName: 'auth_session',
			validateResult: { session: null, user: null }
		})
		const auth = createAuth({
			adapters: { session: sessionAdapter },
			providers: { google: { provider: {} as any } }
		}) as any

		const event = createEvent()
		event.cookies.set('auth_session', 'deadbeef')

		await auth.handlers.hooks({
			event,
			resolve: (_e: any) => new Response('ok')
		})

		expect(sessionAdapter.validateSession).toHaveBeenCalledWith('deadbeef')
		expect(sessionAdapter.deleteSessionCookie).toHaveBeenCalledWith(event.cookies)
	})

	it('refreshes cookie when session is fresh', async () => {
		const session = { id: 's1', fresh: true }
		const user = { id: 'u1' }
		const sessionAdapter = createSessionAdapter({
			validateResult: { session, user }
		})

		const auth = createAuth({
			adapters: { session: sessionAdapter },
			providers: { google: { provider: {} as any } }
		}) as any

		const event = createEvent()
		event.cookies.set('session', 's1')

		await auth.handlers.hooks({
			event,
			resolve: (_e: any) => new Response('ok')
		})

		expect(sessionAdapter.setSessionCookie).toHaveBeenCalledWith(event.cookies, session)
		expect(event.locals.user).toEqual(user)
	})
})
