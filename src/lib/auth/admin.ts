import { dev } from '$app/environment'
import { GoobitsAuth } from '@goobits/auth'
import { createAdminAdapters, ensureAdminUser } from '@packages/calendar/src/admin/auth.ts'
import { getDevDb, type D1DatabaseLike } from '$lib/dev/devDb.ts'

type PlatformLike = { env?: { DB?: D1DatabaseLike } } | null | undefined

async function getDb(platform: PlatformLike) {
	if (dev) {
		return await getDevDb()
	}
	return platform?.env?.DB || null
}

export async function getAdminAuth({ event }: { event: { platform?: PlatformLike } }) {
	const db = await getDb(event.platform)
	if (!db) throw new Error('Database unavailable')
	const env = event.platform?.env || {}
	const secureCookies = env.NODE_ENV !== 'development'

	let sessionLifetimeMs = 60 * 24 * 60 * 60 * 1000
	if (env.ADMIN_SESSION_TTL_DAYS) {
		const days = Number.parseInt(env.ADMIN_SESSION_TTL_DAYS, 10)
		if (Number.isFinite(days)) sessionLifetimeMs = days * 24 * 60 * 60 * 1000
	} else if (env.ADMIN_SESSION_TTL_SECONDS) {
		const seconds = Number.parseInt(env.ADMIN_SESSION_TTL_SECONDS, 10)
		if (Number.isFinite(seconds)) sessionLifetimeMs = seconds * 1000
	}

	const adapters = createAdminAdapters({
		db,
		secureCookies,
		sessionLifetimeMs
	})

	const auth = new GoobitsAuth({
		adapter: {
			session: adapters.sessionAdapter,
			user: adapters.userAdapter
		},
		providers: {},
		profile: 'strict'
	})

	return { auth, db, env, secureCookies, ...adapters }
}

export async function ensureAdminAccount({
	userAdapter,
	env
}: {
	userAdapter: { getUserByEmail: (email: string) => Promise<unknown> }
	env: Record<string, string | undefined>
}) {
	const passcode = env.ADMIN_PASSCODE || ''
	if (!passcode) {
		throw new Error('Admin passcode not configured')
	}
	return ensureAdminUser({ userAdapter, passcode })
}
