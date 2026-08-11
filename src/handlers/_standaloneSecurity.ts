import type { RequestEventLike } from '../types/auth.ts'
import { resolveHandlerRateLimitKey, type HandlerRateLimitConfig } from './rateLimitKey.ts'

/** Executable application-owned boundary for standalone handlers. */
export type StandaloneSecurityBoundary = {
	validateExternalSecurityBoundary?: (event: RequestEventLike) => boolean | Promise<boolean>
}

export type StandaloneHandlerSecurity = StandaloneSecurityBoundary & {
	csrf?: {
		validate?: (event: RequestEventLike) => Promise<boolean>
		errorMessage?: string
	}
	rateLimit?: HandlerRateLimitConfig
}

export type StandaloneSecurityFailure = {
	error: string
	success: false
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

/** Run the shared request-integrity gate used by standalone credential handlers. */
export function createStandaloneSecurityGate(
	handlerName: string,
	config: StandaloneHandlerSecurity
): (event: RequestEventLike) => Promise<StandaloneSecurityFailure | null> {
	const validateBoundary = createStandaloneSecurityBoundaryValidator(handlerName, {
		hasCsrf: typeof config.csrf?.validate === 'function',
		hasRateLimit: typeof config.rateLimit?.check === 'function',
		...(config.validateExternalSecurityBoundary
			? { validateExternalSecurityBoundary: config.validateExternalSecurityBoundary }
			: {})
	})

	return async (event) => {
		if (!(await validateBoundary(event))) {
			return { error: 'Invalid security boundary', success: false }
		}
		if (config.csrf?.validate && !(await config.csrf.validate(event))) {
			return {
				error: config.csrf.errorMessage || 'Invalid CSRF token',
				success: false
			}
		}
		if (config.rateLimit?.check) {
			const verdict = await config.rateLimit.check(
				resolveHandlerRateLimitKey(event, config.rateLimit)
			)
			if (!verdict?.allowed) {
				return { error: 'Too many attempts. Try again later.', success: false }
			}
		}
		return null
	}
}
