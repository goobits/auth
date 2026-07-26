import type { RequestEventLike } from '../types/auth.ts'

/** Resolves the platform-owned client address without trusting request headers. */
export function resolvePlatformClientAddress(
	event: Pick<RequestEventLike, 'getClientAddress'>
): string {
	try {
		return event.getClientAddress?.() || 'unknown'
	} catch {
		return 'unknown'
	}
}
