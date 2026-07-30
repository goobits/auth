import { handleFocusTrapKeyboardEvent } from '@goobits/keyboard/focus'

type BackupCodesModalKeyboardOptions = {
	close: () => void
	modalEl: HTMLElement | null
	visible: boolean
}

/** Contains keyboard navigation only while the backup-code modal is visible. */
export function handleBackupCodesModalKeyboardEvent(
	event: KeyboardEvent,
	{ close, modalEl, visible }: BackupCodesModalKeyboardOptions
): boolean {
	if (!visible) return false
	return handleFocusTrapKeyboardEvent(event, { onEscape: close, root: modalEl })
}
