/** Pg Pool Like typed model for runtime integration. */
export type PgPoolLike = {
	query<T extends Record<string, unknown> = Record<string, unknown>>(
		text: string,
		values?: readonly unknown[]
	): Promise<{ rows: T[] }>
}

export function requireRow<T>(row: T | undefined): T {
	if (!row) {
		throw new Error('Expected database row')
	}
	return row
}
