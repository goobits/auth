import type { RequestEventLike } from '../types/auth.ts'

/** Executable application-owned boundary for standalone handlers. */
export type StandaloneSecurityBoundary = {
	validateExternalSecurityBoundary?: (event: RequestEventLike) => boolean | Promise<boolean>
}

/**
 * Standalone credential handlers must either own both request-integrity guards
 * or declare that an equivalent outer boundary runs first.
 */
export function createStandaloneSecurityBoundaryValidator(
	handlerName: string,
	config: {
		hasCsrf: boolean
		hasRateLimit: boolean
		validateExternalSecurityBoundary?: (event: RequestEventLike) => boolean | Promise<boolean>
	}
): (event: RequestEventLike) => Promise<boolean> {
	if (config.hasCsrf && config.hasRateLimit) return async () => true
	if (typeof config.validateExternalSecurityBoundary !== 'function') {
		throw new TypeError(
			`${handlerName} requires CSRF and rate-limit guards, or validateExternalSecurityBoundary`
		)
	}
	return async (event) => (await config.validateExternalSecurityBoundary?.(event)) === true
}
