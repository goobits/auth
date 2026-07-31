import { describe, expect, it, vi } from 'vitest'

import { handleBackupCodesModalKeyboardEvent } from '../../src/ui/backupCodesModalKeyboard.ts'

describe('backup codes modal keyboard handling', () => {
	it('lets hidden modal key events fall through', () => {
		const close = vi.fn()
		const event = createKeyboardEvent('Escape')

		expect(
			handleBackupCodesModalKeyboardEvent(event, {
				close,
				modalEl: null,
				visible: false
			})
		).toBe(false)
		expect(event.preventDefault).not.toHaveBeenCalled()
		expect(close).not.toHaveBeenCalled()
	})

	it('contains Escape and closes the visible modal', () => {
		const close = vi.fn()
		const event = createKeyboardEvent('Escape')

		expect(
			handleBackupCodesModalKeyboardEvent(event, {
				close,
				modalEl: null,
				visible: true
			})
		).toBe(true)
		expect(event.preventDefault).toHaveBeenCalledOnce()
		expect(event.stopImmediatePropagation).toHaveBeenCalledOnce()
		expect(close).toHaveBeenCalledOnce()
	})
})

function createKeyboardEvent(key: string): KeyboardEvent {
	return {
		key,
		preventDefault: vi.fn(),
		stopImmediatePropagation: vi.fn(),
		stopPropagation: vi.fn()
	} as unknown as KeyboardEvent
}
