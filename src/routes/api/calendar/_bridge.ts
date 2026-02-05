import { dev } from '$app/environment'
import { getDevDb, type D1DatabaseLike } from '$lib/dev/devDb.ts'

type PlatformLike = { env?: { DB?: D1DatabaseLike } } | null | undefined

/**
 * Builds the environment object for API handlers.
 *
 * Production: Uses Cloudflare D1 from platform.env.DB
 * Development: Falls back to local SQLite with D1-compatible wrapper
 */
export async function buildEnv(platform: PlatformLike) {
	// Development: use local SQLite to avoid relying on external bindings
	if (dev) {
		const cachedDevDb = await getDevDb()
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
