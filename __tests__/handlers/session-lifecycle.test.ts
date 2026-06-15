import { describe, expect, it, vi } from 'vitest'

import { AuthPrincipalResolutionError } from '../../src/errors/AuthPrincipalResolutionError.ts'
import { ensureSessionAfterLogin } from '../../src/handlers/sessionLifecycle.ts'
import { createRequestEvent } from '../testKit.ts'

function createSessionAdapter() {
	return {
		createSession: vi.fn(async(userId: string) => ({ id: 's1', userId })),
		setSessionCookie: vi.fn()
	}
}

describe('ensureSessionAfterLogin', () => {
	it('creates a session and sets the cookie when augment mode is active', async() => {
		const sessionAdapter = createSessionAdapter()
		const event = createRequestEvent()

		const userId = await ensureSessionAfterLogin({
			event,
			sessionAdapter: sessionAdapter as never,
			userId: 'u1'
		})

		expect(userId).toBe('u1')
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u1')
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalledWith(
			event.cookies,
			{ id: 's1', userId: 'u1' }
		)
	})

	it('throws AuthPrincipalResolutionError when userId is null', async() => {
		const sessionAdapter = createSessionAdapter()
		const event = createRequestEvent()

		await expect(
			ensureSessionAfterLogin({
				event,
				sessionAdapter: sessionAdapter as never,
				userId: null
			})
		).rejects.toBeInstanceOf(AuthPrincipalResolutionError)
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
	})

	it('skips session creation in manual mode but still returns the userId', async() => {
		const sessionAdapter = createSessionAdapter()
		const event = createRequestEvent()

		const userId = await ensureSessionAfterLogin({
			event,
			sessionAdapter: sessionAdapter as never,
			userId: 'u2',
			onLoginMode: 'manual'
		})

		expect(userId).toBe('u2')
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
		expect(sessionAdapter.setSessionCookie).not.toHaveBeenCalled()
	})

	it('skips session creation when autoCreateSession is false', async() => {
		const sessionAdapter = createSessionAdapter()
		const event = createRequestEvent()

		await ensureSessionAfterLogin({
			event,
			sessionAdapter: sessionAdapter as never,
			userId: 'u3',
			autoCreateSession: false
		})

		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
	})

	it('works without a setSessionCookie implementation', async() => {
		const sessionAdapter = {
			createSession: vi.fn(async(userId: string) => ({ id: 's', userId }))
		}
		const event = createRequestEvent()

		const userId = await ensureSessionAfterLogin({
			event,
			sessionAdapter: sessionAdapter as never,
			userId: 'u4'
		})

		expect(userId).toBe('u4')
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u4')
	})
})
