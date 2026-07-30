import { describe, expect, it, vi } from 'vitest'

import { type AssuredSessionAdapter, rotateSessionAssurance } from '../../src/handlers/index.ts'
import type { Session, SessionMetadata } from '../../src/types/core.ts'
import { createCookies } from '../testKit.ts'

function currentSession(overrides: Partial<Session> = {}): Session {
	return {
		id: 'current-session',
		userId: 'user-1',
		expiresAt: new Date('2026-07-30T04:00:00.000Z'),
		createdAt: new Date('2026-07-30T02:00:00.000Z'),
		mfaVerifiedAt: new Date('2026-07-30T02:30:00.000Z'),
		rememberMe: true,
		ip: '192.0.2.10',
		userAgent: 'Test Agent',
		fingerprint: 'fingerprint-1',
		...overrides
	}
}

function sessionAdapter() {
	const createSession = vi.fn(
		async (userId: string, metadata: SessionMetadata = {}): Promise<Session> => ({
			id: 'replacement-session',
			userId,
			expiresAt: new Date('2026-07-31T04:00:00.000Z'),
			...metadata
		})
	)
	const adapter: AssuredSessionAdapter = {
		createSession,
		invalidateSession: vi.fn(async () => undefined),
		setSessionCookie: vi.fn()
	}
	return { adapter, createSession }
}

describe('rotateSessionAssurance', () => {
	it('refreshes primary assurance while preserving trusted MFA and session context', async () => {
		const { adapter, createSession } = sessionAdapter()
		const current = currentSession()
		const verifiedAt = new Date('2026-07-30T03:00:00.000Z')

		const replacement = await rotateSessionAssurance({
			sessionAdapter: adapter,
			assurance: 'primary',
			cookies: createCookies(),
			currentSession: current,
			userId: 'user-1',
			verifiedAt
		})

		expect(replacement.createdAt).toEqual(verifiedAt)
		expect(createSession).toHaveBeenCalledWith('user-1', {
			createdAt: verifiedAt,
			mfaVerifiedAt: current.mfaVerifiedAt,
			rememberMe: true,
			ip: '192.0.2.10',
			userAgent: 'Test Agent',
			fingerprint: 'fingerprint-1'
		})
		expect(adapter.invalidateSession).toHaveBeenCalledWith('current-session')
		expect(adapter.setSessionCookie).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ id: 'replacement-session' })
		)
	})

	it('refreshes MFA assurance without making stale primary authentication recent', async () => {
		const { adapter, createSession } = sessionAdapter()
		const current = currentSession({ createdAt: undefined, mfaVerifiedAt: null })
		const verifiedAt = new Date('2026-07-30T03:00:00.000Z')

		await rotateSessionAssurance({
			sessionAdapter: adapter,
			assurance: 'mfa',
			cookies: createCookies(),
			currentSession: current,
			userId: 'user-1',
			verifiedAt
		})

		expect(createSession).toHaveBeenCalledWith(
			'user-1',
			expect.objectContaining({
				createdAt: new Date(0),
				mfaVerifiedAt: verifiedAt
			})
		)
	})

	it('fails before rotation for a mismatched principal, kind, or timestamp', async () => {
		const { adapter, createSession } = sessionAdapter()
		const options = {
			sessionAdapter: adapter,
			assurance: 'primary' as const,
			cookies: createCookies(),
			currentSession: currentSession(),
			userId: 'other-user'
		}

		await expect(rotateSessionAssurance(options)).rejects.toThrow(/principal mismatch/)
		await expect(
			Reflect.apply(rotateSessionAssurance, undefined, [
				{
					...options,
					assurance: 'unknown',
					userId: 'user-1'
				}
			])
		).rejects.toThrow(/invalid session assurance kind/)
		await expect(
			rotateSessionAssurance({
				...options,
				currentSession: currentSession(),
				userId: 'user-1',
				verifiedAt: new Date(Number.NaN)
			})
		).rejects.toThrow(/invalid session assurance timestamp/)
		expect(createSession).not.toHaveBeenCalled()
	})

	it('removes a replacement session when invalidating the old session fails', async () => {
		const { adapter } = sessionAdapter()
		vi.mocked(adapter.invalidateSession)
			.mockRejectedValueOnce(new Error('store unavailable'))
			.mockResolvedValueOnce(undefined)

		await expect(
			rotateSessionAssurance({
				sessionAdapter: adapter,
				assurance: 'primary',
				cookies: createCookies(),
				currentSession: currentSession(),
				userId: 'user-1'
			})
		).rejects.toThrow(/store unavailable/)
		expect(adapter.invalidateSession).toHaveBeenNthCalledWith(1, 'current-session')
		expect(adapter.invalidateSession).toHaveBeenNthCalledWith(2, 'replacement-session')
		expect(adapter.setSessionCookie).not.toHaveBeenCalled()
	})
})
