export type D1DatabaseLike = {
	prepare(query: string): {
		bind: (...args: unknown[]) => {
			run: () => Promise<unknown>
		}
	}
}

let cachedDevDb: D1DatabaseLike | null = null

export async function getDevDb(): Promise<D1DatabaseLike> {
	if (!cachedDevDb) {
		const { createSqliteDb } = await import('$lib/dev/sqliteDb.ts')
		cachedDevDb = createSqliteDb() as D1DatabaseLike
	}
	return cachedDevDb
}
