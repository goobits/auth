// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BackupCodesModal from '../../src/ui/BackupCodesModal.svelte'

const writeText = vi.fn(async () => {})
const createObjectURL = vi.fn(() => 'blob:backup-codes')
const revokeObjectURL = vi.fn()

beforeEach(() => {
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText }
	})
	Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
	Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	vi.restoreAllMocks()
})

describe('BackupCodesModal', () => {
	it('copies, downloads, and acknowledges backup codes', async () => {
		const onAcknowledge = vi.fn()
		const onClose = vi.fn()
		render(BackupCodesModal, {
			visible: true,
			backupCodes: ['alpha-code', 'beta-code'],
			isNewEnrollment: true,
			onAcknowledge,
			onClose
		})

		expect(screen.getByRole('dialog', { name: 'Save Your Backup Codes' })).toBeTruthy()
		expect(screen.getByText('alpha-code')).toBeTruthy()
		const continueButton = screen.getByRole('button', { name: 'Continue' })
		expect(continueButton.hasAttribute('disabled')).toBe(true)

		await fireEvent.click(screen.getByRole('button', { name: 'Copy to Clipboard' }))
		await waitFor(() => expect(writeText).toHaveBeenCalledWith('alpha-code\nbeta-code'))
		expect(screen.getByText('Copied to clipboard.')).toBeTruthy()

		await fireEvent.click(screen.getByRole('button', { name: 'Download Codes' }))
		expect(createObjectURL).toHaveBeenCalledOnce()
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup-codes')

		await fireEvent.click(screen.getByRole('checkbox'))
		expect(continueButton.hasAttribute('disabled')).toBe(false)
		await fireEvent.click(continueButton)
		expect(onAcknowledge).toHaveBeenCalledOnce()
		expect(onClose).toHaveBeenCalledOnce()
		expect(screen.queryByRole('dialog')).toBeNull()
	})

	it('contains Escape, closes, and restores the previous focus', async () => {
		const opener = document.createElement('button')
		document.body.appendChild(opener)
		opener.focus()
		const onClose = vi.fn()
		render(BackupCodesModal, { visible: true, backupCodes: ['alpha-code'], onClose })
		const dialog = screen.getByRole('dialog')
		await waitFor(() => expect(document.activeElement).toBe(dialog))

		await fireEvent.keyDown(window, { key: 'Escape' })
		expect(onClose).toHaveBeenCalledOnce()
		expect(screen.queryByRole('dialog')).toBeNull()
		expect(document.activeElement).toBe(opener)
		opener.remove()
	})
})
