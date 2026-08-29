// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SessionManager from '../../src/ui/SessionManager.svelte'

const currentSession = {
	id: 'current-session',
	userId: 'user-1',
	expiresAt: '2026-09-01T12:00:00.000Z',
	createdAt: null,
	lastActiveAt: null,
	ip: '127.0.0.1',
	userAgent: null,
	current: true
}
const otherSession = {
	...currentSession,
	id: 'other-session',
	ip: '203.0.113.8',
	current: false
}

afterEach(cleanup)

describe('SessionManager', () => {
	it('renders server-provided sessions without fetching or remaining busy', () => {
		const fetcher = vi.fn()
		const { container } = render(SessionManager, {
			sessions: [currentSession],
			fetcher: fetcher as unknown as typeof fetch
		})

		expect(screen.getByText(/Current session · 127\.0\.0\.1/)).toBeTruthy()
		expect(screen.queryByRole('button', { name: /Revoke session/ })).toBeNull()
		expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('false')
		expect(fetcher).not.toHaveBeenCalled()
	})

	it('loads sessions, revokes a selected session, and refreshes the list', async () => {
		const responses = [
			{ ok: true, sessions: [currentSession, otherSession] },
			{ ok: true },
			{ ok: true, sessions: [currentSession] }
		]
		const fetcher = vi.fn(async () => {
			const body = responses.shift()
			if (!body) throw new Error('Unexpected request')
			return new Response(JSON.stringify(body), {
				headers: { 'content-type': 'application/json' }
			})
		}) as unknown as typeof fetch
		render(SessionManager, {
			fetcher,
			listEndpoint: '/account/sessions',
			revokeEndpoint: '/account/sessions/revoke'
		})

		const list = await screen.findByRole('list', { name: 'Active sessions' })
		expect(within(list).getAllByRole('listitem')).toHaveLength(2)
		await fireEvent.click(screen.getByRole('button', { name: 'Revoke session 203.0.113.8' }))
		await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1))

		const calls = vi.mocked(fetcher).mock.calls
		expect(calls.map(([url, init]) => [String(url), init?.method])).toEqual([
			['/account/sessions', 'GET'],
			['/account/sessions/revoke', 'POST'],
			['/account/sessions', 'GET']
		])
		expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({ sessionId: 'other-session' })
	})

	it('surfaces a safe load failure and supports label overrides', async () => {
		const fetcher = vi.fn(async () => {
			throw new Error('Network unavailable')
		}) as unknown as typeof fetch
		render(SessionManager, { fetcher, labels: { empty: 'Nothing active' } })

		expect((await screen.findByRole('alert')).textContent).toBe('Network unavailable')
		expect(screen.getByText('Nothing active')).toBeTruthy()
	})
})
