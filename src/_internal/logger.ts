import { noopLogger, type Logger } from '@goobits/security/logger'

export type { Logger }

/** Resolves an instance-owned logger without ambient mutable state. */
export function resolveLogger(logger: Logger | null | undefined): Logger {
	return logger ?? noopLogger
}

/** Keeps thrown values structured and bounded at logging call sites. */
export function errorContext(error: unknown): Record<string, unknown> {
	if (!(error instanceof Error)) return { errorType: typeof error }
	const errorName = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(error.name) ? error.name : 'Error'
	return { errorType: errorName }
}
