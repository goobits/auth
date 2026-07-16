/** Explicit escape hatch for handlers protected by an application-owned outer policy. */
export type StandaloneSecurityBoundary = {
	externalSecurityBoundary?: true
}

/**
 * Standalone credential handlers must either own both request-integrity guards
 * or declare that an equivalent outer boundary runs first.
 */
export function assertStandaloneSecurityBoundary(
	handlerName: string,
	config: {
		hasCsrf: boolean
		hasRateLimit: boolean
		externalSecurityBoundary?: true
	}
): void {
	if (config.externalSecurityBoundary === true) return
	if (config.hasCsrf && config.hasRateLimit) return
	throw new TypeError(
		`${handlerName} requires CSRF and rate-limit guards, or externalSecurityBoundary: true`
	)
}
