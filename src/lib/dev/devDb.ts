export type D1PreparedStatement = {
	bind: (...args: unknown[]) => D1PreparedStatement
	first: <T = Record<string, unknown>>() => Promise<T | null>
	all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>
	run: () => Promise<{ meta: { last_row_id: number; changes: number } }>
}

export type D1DatabaseLike = {
	prepare(query: string): D1PreparedStatement
}

let cachedDevDb: D1DatabaseLike | undefined

export async function getDevDb(): Promise<D1DatabaseLike> {
	if (cachedDevDb) return cachedDevDb
	const { createSqliteDb } = await import('$lib/dev/sqliteDb.ts')
	cachedDevDb = createSqliteDb()
	return cachedDevDb
}
