// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
	cleanup()
	vi.unstubAllGlobals()
	vi.resetModules()
})

describe('AuthGate store fallback', () => {
	it('uses the store only for undefined user props and respects explicit null', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				new Response(JSON.stringify({ success: true, user: { id: 'store-user' } }), {
					headers: { 'content-type': 'application/json' }
				})
			)
		)
		const { auth } = await import('../../src/ui/authStore.ts')
		await auth.login('member@example.com', 'correct-password')
		const { default: AuthGateHarness } = await import('./fixtures/AuthGateHarness.svelte')
		const view = render(AuthGateHarness, { user: undefined, loading: false })

		expect(screen.getByText('Account ready')).toBeTruthy()
		await view.rerender({ user: null, loading: false })
		expect(screen.getByText('Please sign in')).toBeTruthy()
		expect(screen.queryByText('Account ready')).toBeNull()
	})
})
