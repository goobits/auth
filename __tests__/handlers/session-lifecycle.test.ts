import { describe, expect, it, vi } from 'vitest'

import { AuthPrincipalResolutionError } from '../../src/errors/AuthPrincipalResolutionError.ts'
import { ensureSessionAfterLogin } from '../../src/handlers/sessionLifecycle.ts'
import { createMfaLoginTestConfig, createRequestEvent } from '../testKit.ts'

function createSessionAdapter() {
	return {
		createSession: vi.fn(async (userId: string) => ({ id: 's1', userId })),
		setSessionCookie: vi.fn()
	}
}

describe('ensureSessionAfterLogin', () => {
	it('creates a session and sets the cookie when augment mode is active', async () => {
		const sessionAdapter = createSessionAdapter()
		const event = createRequestEvent()

		const result = await ensureSessionAfterLogin({
			event,
			sessionAdapter: sessionAdapter as never,
			userId: 'u1'
		})

		expect(result).toEqual({ status: 'authenticated', userId: 'u1' })
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u1')
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalledWith(event.cookies, {
			id: 's1',
			userId: 'u1'
		})
	})

	it('merges application metadata while keeping assurance timestamps protocol-owned', async () => {
		const sessionAdapter = createSessionAdapter()
		const event = createRequestEvent()
		const assuredAt = new Date('2026-07-28T11:00:00.000Z')
		const getSessionMetadata = vi.fn(async () => ({
			createdAt: new Date('2002-01-01T00:00:00.000Z'),
			fingerprint: 'fingerprint-1',
			mfaVerifiedAt: new Date('2002-01-01T00:00:00.000Z')
		}))

		await ensureSessionAfterLogin({
			event,
			sessionAdapter: sessionAdapter as never,
			userId: 'u1',
			getSessionMetadata,
			sessionMetadata: { mfaVerifiedAt: assuredAt }
		})

		expect(getSessionMetadata).toHaveBeenCalledWith(event, 'u1')
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u1', {
			fingerprint: 'fingerprint-1',
			mfaVerifiedAt: assuredAt
		})
	})

	it('throws AuthPrincipalResolutionError when userId is null', async () => {
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

	it('skips session creation in manual mode but still returns the userId', async () => {
		const sessionAdapter = createSessionAdapter()
		const event = createRequestEvent()

		const result = await ensureSessionAfterLogin({
			event,
			sessionAdapter: sessionAdapter as never,
			userId: 'u2',
			onLoginMode: 'manual'
		})

		expect(result).toEqual({ status: 'authenticated', userId: 'u2' })
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
		expect(sessionAdapter.setSessionCookie).not.toHaveBeenCalled()
	})

	it('skips session creation when autoCreateSession is false', async () => {
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

	it('works without a setSessionCookie implementation', async () => {
		const sessionAdapter = {
			createSession: vi.fn(async (userId: string) => ({ id: 's', userId }))
		}
		const event = createRequestEvent()

		const result = await ensureSessionAfterLogin({
			event,
			sessionAdapter: sessionAdapter as never,
			userId: 'u4'
		})

		expect(result).toEqual({ status: 'authenticated', userId: 'u4' })
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u4')
	})

	it('defers session creation and preserves the destination when MFA is enabled', async () => {
		const sessionAdapter = createSessionAdapter()
		const event = createRequestEvent()
		const { config: mfa, replaceForUserAndType } = createMfaLoginTestConfig()

		const result = await ensureSessionAfterLogin({
			event,
			sessionAdapter: sessionAdapter as never,
			userId: 'u5',
			user: {
				id: 'u5',
				email: 'u5@example.com',
				name: 'User Five',
				avatar: null,
				emailVerified: true
			},
			redirectTo: '/library',
			mfa
		})

		expect(result).toMatchObject({
			status: 'mfa-required',
			userId: 'u5',
			redirectTo: '/login?mfa=required',
			response: { success: true, twoFactorRequired: true }
		})
		expect(replaceForUserAndType).toHaveBeenCalledWith(
			expect.objectContaining({ metadata: { redirectTo: '/library' } })
		)
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
	})
})
