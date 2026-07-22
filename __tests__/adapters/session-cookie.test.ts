import { describe, expect, it, vi } from 'vitest'
import {
	clearSessionCookie,
	writeSessionCookie
} from '../../src/adapters/session/_sessionCookie.ts'

const cookies = () => ({
	set: vi.fn(),
	delete: vi.fn()
})

describe('session cookie policy', () => {
	it('writes the shared secure cookie attributes without inventing a domain', () => {
		const jar = cookies()
		const expiresAt = new Date('2026-08-01T00:00:00.000Z')

		writeSessionCookie(jar as never, { id: 'session-token', expiresAt }, 'auth', true)

		expect(jar.set).toHaveBeenCalledWith('auth', 'session-token', {
			expires: expiresAt,
			httpOnly: true,
			path: '/',
			sameSite: 'lax',
			secure: true
		})
	})

	it('applies the same configured domain when writing and clearing', () => {
		const jar = cookies()
		const expiresAt = new Date('2026-08-01T00:00:00.000Z')

		writeSessionCookie(
			jar as never,
			{ id: 'session-token', expiresAt },
			'auth',
			false,
			'.bandamp.org'
		)
		clearSessionCookie(jar as never, 'auth', '.bandamp.org')

		expect(jar.set).toHaveBeenCalledWith(
			'auth',
			'session-token',
			expect.objectContaining({ domain: '.bandamp.org', secure: false })
		)
		expect(jar.delete).toHaveBeenCalledWith('auth', {
			domain: '.bandamp.org',
			path: '/'
		})
	})
})
