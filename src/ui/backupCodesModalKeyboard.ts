type BackupCodesModalKeyboardOptions = {
	close: () => void
	modalEl: HTMLElement | null
	visible: boolean
}

const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(',')

/** Contains keyboard navigation only while the backup-code modal is visible. */
export function handleBackupCodesModalKeyboardEvent(
	event: KeyboardEvent,
	{ close, modalEl, visible }: BackupCodesModalKeyboardOptions
): boolean {
	if (!visible) return false
	if (event.key === 'Escape') {
		containKeyboardEvent(event)
		close()
		return true
	}
	if (event.key !== 'Tab' || !modalEl) return false

	const focusable = [...modalEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
		(element) => element.getAttribute('aria-hidden') !== 'true'
	)
	const first = focusable[0]
	const last = focusable.at(-1)
	if (!first || !last) return false

	const active = modalEl.ownerDocument.activeElement
	const outside = !active || !modalEl.contains(active)
	const target = event.shiftKey
		? outside || active === first
			? last
			: null
		: outside || active === last
			? first
			: null
	if (!target) return false

	containKeyboardEvent(event)
	target.focus()
	return true
}

function containKeyboardEvent(event: KeyboardEvent): void {
	event.preventDefault()
	event.stopImmediatePropagation()
}
