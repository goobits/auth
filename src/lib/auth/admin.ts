import { dev } from '$app/environment'
import { GoobitsAuth } from '@goobits/auth'
import { createAdminAdapters, ensureAdminUser } from '@miko/calendar'
import { getDevDb, type D1DatabaseLike } from '$lib/dev/devDb.ts'
import type { User } from '@goobits/auth/types'

type PlatformEnv = {
	DB?: D1DatabaseLike
	NODE_ENV?: string
	ADMIN_SESSION_TTL_DAYS?: string
	ADMIN_SESSION_TTL_SECONDS?: string
	ADMIN_PASSCODE?: string
	[key: string]: string | D1DatabaseLike | undefined
}
type PlatformLike = { env?: PlatformEnv } | null | undefined

async function getDb(platform: PlatformLike) {
	if (dev) {
		return await getDevDb()
	}
	return platform?.env?.DB || null
}

export async function getAdminAuth({ event }: { event: { platform?: PlatformLike; url: URL } }) {
	const db = await getDb(event.platform)
	if (!db) throw new Error('Database unavailable')
	const env = {
		...Object.fromEntries(
			Object.entries(process.env).filter(([, value]) => typeof value === 'string')
		),
		...(event.platform?.env ?? {})
	} as Record<string, string | undefined>
	// Browsers will not persist `Secure` cookies over plain http (e.g. localhost dev),
	// which makes admin login appear to "work" server-side but never stick client-side.
	const url = event.url
	const isHttps = url?.protocol === 'https:'
	const secureCookies = !dev && isHttps

	let sessionLifetimeMs = 60 * 24 * 60 * 60 * 1000
	if (env['ADMIN_SESSION_TTL_DAYS']) {
		const days = Number.parseInt(env['ADMIN_SESSION_TTL_DAYS'], 10)
		if (Number.isFinite(days)) sessionLifetimeMs = days * 24 * 60 * 60 * 1000
	} else if (env['ADMIN_SESSION_TTL_SECONDS']) {
		const seconds = Number.parseInt(env['ADMIN_SESSION_TTL_SECONDS'], 10)
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
		cookies: {
			secure: secureCookies
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
	userAdapter: {
		getUserByEmail: (email: string) => Promise<User | null>
		createUser: (
			profile: { email: string; name: string; verified_email: boolean },
			metadata: { password: string }
		) => Promise<User>
	}
	env: Record<string, string | undefined>
}) {
	const passcode = env['ADMIN_PASSCODE'] || ''
	if (!passcode) {
		throw new Error('Admin passcode not configured')
	}
	return ensureAdminUser({ userAdapter, passcode })
}
