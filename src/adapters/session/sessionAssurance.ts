/** Converts persisted session assurance into a valid date or a fail-closed null value. */
export function parseMfaVerifiedAt(value: unknown): Date | null {
	if (value === null || value === undefined) return null
	if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
		return null
	}
	const parsed = value instanceof Date ? value : new Date(value)
	return Number.isNaN(parsed.getTime()) ? null : parsed
}
