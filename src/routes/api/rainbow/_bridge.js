import { dev } from '$app/environment'

let cachedDevDb = null

export async function buildEnv(platform) {
	if (platform?.env?.DB) {
		return {
			...Object.fromEntries(
				Object.entries(process.env).filter(([_, v]) => typeof v === 'string')
			),
			...platform.env
		}
	}

	if (dev) {
		if (!cachedDevDb) {
			const { createSqliteDb } = await import('$lib/dev/sqliteDb.js')
			cachedDevDb = createSqliteDb()
		}
		return {
			...process.env,
			DB: cachedDevDb
		}
	}

	throw new Error('Database not available. Ensure D1 is configured in wrangler.toml.')
}
