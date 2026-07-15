import type { RequestEventLike } from '../types/auth.ts'

export type HandlerRateLimitConfig = {
	check?: (key: string) => Promise<{ allowed: boolean }>
	key?: (event: RequestEventLike) => string
}

/** Resolves a handler rate-limit key without trusting request-supplied proxy headers. */
export function resolveHandlerRateLimitKey(
	event: RequestEventLike,
	config?: Pick<HandlerRateLimitConfig, 'key'>
): string {
	return config?.key?.(event) ?? event.getClientAddress?.() ?? 'unknown'
}
