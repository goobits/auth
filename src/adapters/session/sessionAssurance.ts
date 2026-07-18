type NumericTimestampUnit = 'milliseconds' | 'seconds'

/** Converts a persisted session timestamp into a valid date or a fail-closed null value. */
export function parseSessionTimestamp(
	value: unknown,
	numericUnit: NumericTimestampUnit = 'milliseconds'
): Date | null {
	if (value === null || value === undefined) return null
	if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
		return null
	}
	const normalized = typeof value === 'number' && numericUnit === 'seconds' ? value * 1000 : value
	const parsed = normalized instanceof Date ? normalized : new Date(normalized)
	return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Converts persisted MFA assurance into a valid date or a fail-closed null value. */
export function parseMfaVerifiedAt(
	value: unknown,
	numericUnit: NumericTimestampUnit = 'milliseconds'
): Date | null {
	return parseSessionTimestamp(value, numericUnit)
}
