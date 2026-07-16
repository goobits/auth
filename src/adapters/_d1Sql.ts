const D1_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/u

/** Validates an identifier before it is interpolated into D1 SQL. */
export function assertD1Identifier(value: string, label: string): string {
	if (!D1_IDENTIFIER.test(value)) {
		throw new TypeError(`@goobits/auth: invalid D1 SQL identifier for ${label}`)
	}
	return value
}

/** Validates a named group of required and optional D1 identifiers. */
export function assertD1Identifiers(values: Record<string, string | null>): void {
	for (const [label, value] of Object.entries(values)) {
		if (value !== null) assertD1Identifier(value, label)
	}
}
