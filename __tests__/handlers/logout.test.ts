import { describe, expect, it, vi } from 'vitest'

import { createLogoutAction, createLogoutHandler } from '../../src/handlers/logout.ts'
import type { RequestEventLike } from '../../src/types/auth.ts'
import { createRequestEvent } from '../testKit.ts'

function createSessionAdapter() {
	return {
		invalidateSession: vi.fn(async () => undefined),
		deleteSessionCookie: vi.fn()
	}
}

function captureRedirect<T>(promise: Promise<T>) {
	return promise.then(
		() => {
			throw new Error('Expected handler to redirect')
		},
		(err) => err as { status?: number; location?: string }
	)
}

describe('createLogoutHandler', () => {
	it('invalidates the session and deletes the cookie when authenticated', async () => {
		const sessionAdapter = createSessionAdapter()
		const handler = createLogoutHandler({
			sessionAdapter: sessionAdapter as never,
			redirectAfterLogout: '/sign-in'
		})

		const event = createRequestEvent({
			method: 'POST',
			locals: { user: { id: 'u1' }, session: { id: 's1' } } as never
		}) as unknown as RequestEventLike

		const err = await captureRedirect(handler(event as never))
		expect(err.status).toBe(302)
		expect(err.location).toBe('/sign-in')
		expect(sessionAdapter.invalidateSession).toHaveBeenCalledWith('s1')
		expect(sessionAdapter.deleteSessionCookie).toHaveBeenCalledWith(event.cookies)
	})

	it('redirects without touching the adapter when there is no session', async () => {
		const sessionAdapter = createSessionAdapter()
		const handler = createLogoutHandler({
			sessionAdapter: sessionAdapter as never
		})

		const event = createRequestEvent({ method: 'POST' }) as unknown as RequestEventLike
		const err = await captureRedirect(handler(event as never))
		expect(err.status).toBe(302)
		expect(err.location).toBe('/')
		expect(sessionAdapter.invalidateSession).not.toHaveBeenCalled()
		expect(sessionAdapter.deleteSessionCookie).not.toHaveBeenCalled()
	})

	it('invokes onLogout after invalidating the session', async () => {
		const sessionAdapter = createSessionAdapter()
		const onLogout = vi.fn(async () => undefined)
		const handler = createLogoutHandler({
			sessionAdapter: sessionAdapter as never,
			onLogout
		})

		const event = createRequestEvent({
			method: 'POST',
			locals: { session: { id: 's1' } } as never
		}) as unknown as RequestEventLike

		await captureRedirect(handler(event as never))
		expect(onLogout).toHaveBeenCalledWith(event)
	})

	it('still redirects when the adapter throws', async () => {
		const sessionAdapter = {
			invalidateSession: vi.fn(async () => {
				throw new Error('db unreachable')
			}),
			deleteSessionCookie: vi.fn()
		}
		const handler = createLogoutHandler({
			sessionAdapter: sessionAdapter as never
		})

		const event = createRequestEvent({
			method: 'POST',
			locals: { session: { id: 's1' } } as never
		}) as unknown as RequestEventLike

		const err = await captureRedirect(handler(event as never))
		expect(err.status).toBe(302)
	})

	it('keeps logger delivery isolated per handler instance', async () => {
		const firstLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
		const secondLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
		const throwingAdapter = (message: string) => ({
			invalidateSession: vi.fn(async () => {
				const error = new Error('sensitive storage detail')
				error.name = message
				throw error
			}),
			deleteSessionCookie: vi.fn()
		})
		const first = createLogoutHandler({
			sessionAdapter: throwingAdapter('first') as never,
			logger: firstLogger
		})
		const second = createLogoutHandler({
			sessionAdapter: throwingAdapter('second') as never,
			logger: secondLogger
		})
		const event = () =>
			createRequestEvent({
				method: 'POST',
				locals: { session: { id: 's1' } } as never
			}) as unknown as RequestEventLike

		await captureRedirect(first(event() as never))
		expect(firstLogger.error).toHaveBeenCalledWith('Error during logout', { errorType: 'first' })
		expect(secondLogger.error).not.toHaveBeenCalled()

		await captureRedirect(second(event() as never))
		expect(secondLogger.error).toHaveBeenCalledWith('Error during logout', { errorType: 'second' })
		expect(firstLogger.error).toHaveBeenCalledOnce()
	})
})

describe('createLogoutAction', () => {
	it('exposes a `default` form action that invalidates the session', async () => {
		const sessionAdapter = createSessionAdapter()
		const actions = createLogoutAction({
			sessionAdapter: sessionAdapter as never,
			redirectAfterLogout: '/login'
		})
		expect(typeof actions.default).toBe('function')

		const event = createRequestEvent({
			method: 'POST',
			locals: { session: { id: 's99' } } as never
		}) as unknown as RequestEventLike
		const err = await captureRedirect(
			(actions.default as (e: RequestEventLike) => Promise<unknown>)(event)
		)
		expect(err.status).toBe(302)
		expect(err.location).toBe('/login')
		expect(sessionAdapter.invalidateSession).toHaveBeenCalledWith('s99')
	})
})
