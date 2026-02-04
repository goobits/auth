import { dev } from '$app/environment'

let cachedDevDb = null

/**
 * Builds the environment object for API handlers.
 *
 * Production: Uses Cloudflare D1 from platform.env.DB
 * Development: Falls back to local SQLite with D1-compatible wrapper
 */
export async function buildEnv(platform) {
	// Development: use local SQLite to avoid relying on external bindings
	if (dev) {
		if (!cachedDevDb) {
			// Dynamic import - only executed in dev, tree-shaken in prod
			const { createSqliteDb } = await import('$lib/dev/sqliteDb.js')
			cachedDevDb = createSqliteDb()
		}
		return {
			...process.env,
			DB: cachedDevDb
		}
	}

	// Cloudflare Pages provides bindings via platform.env
	if (platform?.env?.DB) {
		return {
			...Object.fromEntries(
				Object.entries(process.env).filter(([_, v]) => typeof v === 'string')
			),
			...platform.env
		}
	}

	throw new Error(
		'Database not available. Ensure D1 is configured in wrangler.toml.'
	)
}
