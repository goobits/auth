// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AuthNotification from '../../src/ui/AuthNotification.svelte'
import OAuthProviderButton from '../../src/ui/OAuthProviderButton.svelte'
import QrCode from '../../src/ui/QrCode.svelte'
import AuthGateHarness from './fixtures/AuthGateHarness.svelte'

afterEach(cleanup)

describe('published auth presentation components', () => {
	it('renders each AuthGate state and notifies unauthenticated consumers', async () => {
		const onUnauthenticated = vi.fn()
		const view = render(AuthGateHarness, { loading: true, onUnauthenticated })

		expect(screen.getByText('Checking account')).toBeTruthy()
		expect(onUnauthenticated).not.toHaveBeenCalled()

		await view.rerender({ user: { id: 'user-1' }, loading: false, onUnauthenticated })
		expect(screen.getByText('Account ready')).toBeTruthy()

		await view.rerender({ user: null, loading: false, onUnauthenticated })
		expect(screen.getByText('Please sign in')).toBeTruthy()
		await waitFor(() => expect(onUnauthenticated).toHaveBeenCalledOnce())
	})

	it('runs notification actions and removes a dismissed alert', async () => {
		const onCta = vi.fn()
		const onClose = vi.fn()
		render(AuthNotification, {
			visible: true,
			title: 'Signed in',
			message: 'Your account is ready.',
			ctaLabel: 'Continue',
			onCta,
			onClose
		})

		expect(screen.getByRole('alert').textContent).toContain('Your account is ready.')
		await fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
		expect(onCta).toHaveBeenCalledOnce()

		await fireEvent.click(screen.getByRole('button', { name: 'Close notification' }))
		expect(onClose).toHaveBeenCalledOnce()
		expect(screen.queryByRole('alert')).toBeNull()
	})

	it('preserves OAuth button semantics while applying provider state', async () => {
		const onclick = vi.fn()
		render(OAuthProviderButton, {
			provider: 'google',
			label: 'Continue with Google',
			class: 'login-form__provider',
			onclick
		})
		const button = screen.getByRole('button', { name: 'Continue with Google' })

		expect(button.classList.contains('oauth-provider--google')).toBe(true)
		expect(button.classList.contains('login-form__provider')).toBe(true)
		await fireEvent.click(button)
		expect(onclick).toHaveBeenCalledOnce()

		cleanup()
		render(OAuthProviderButton, {
			provider: 'apple',
			label: 'Continue with Apple',
			busy: true
		})
		const busyButton = screen.getByRole('button', { name: 'Continue with Apple' })
		expect(busyButton.hasAttribute('disabled')).toBe(true)
		expect(busyButton.getAttribute('aria-busy')).toBe('true')
	})

	it('renders bounded, labelled QR output without markup for empty values', async () => {
		const view = render(QrCode, {
			value: 'otpauth://totp/example',
			label: 'Authenticator setup',
			size: 999,
			className: 'mfa-setup__qr'
		})
		const qr = screen.getByRole('img', { name: 'Authenticator setup' })

		expect(qr.getAttribute('style')).toContain('320px')
		expect(qr.classList.contains('mfa-setup__qr')).toBe(true)
		expect(qr.querySelector('svg')).not.toBeNull()

		await view.rerender({ value: '   ', label: 'Empty code', size: 1 })
		const empty = screen.getByRole('img', { name: 'Empty code' })
		expect(empty.getAttribute('style')).toContain('64px')
		expect(empty.querySelector('svg')).toBeNull()
	})
})
