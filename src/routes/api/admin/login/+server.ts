import { json, type RequestEvent } from '@sveltejs/kit'
import { getAdminAuth, ensureAdminAccount, getAdminEmail } from '$lib/auth/admin.ts'
import { checkRateLimit } from '@packages/calendar/src/index.ts'
import { noStoreHeaders } from '../_helpers.ts'

type AuthUser = { id: string | number }

function isAuthUser(value: unknown): value is AuthUser {
	if (!value || typeof value !== 'object') return false
	const id = (value as AuthUser).id
	return typeof id === 'string' || typeof id === 'number'
}

export async function POST(event: RequestEvent) {
	try {
		const { request, platform, cookies } = event
		const { userAdapter, sessionAdapter, credentialsProvider, env, db } = await getAdminAuth({ event: { platform } })
		await ensureAdminAccount({ userAdapter, env })

		const ip = event.getClientAddress?.() || request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
		try {
			const rate = await checkRateLimit({ db, key: `rate:admin_login:${ip}`, limit: 10, windowSeconds: 60 })
			if (!rate.allowed) {
				return json({ ok: false, error: { message: 'Too many requests' } }, { status: 429, headers: noStoreHeaders })
			}
		} catch {
			// If rate limiting is unavailable, proceed without logging sensitive details.
		}

		const body = await request.json().catch(() => null)
		const passcode = body?.passcode
		if (!passcode) {
			return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401, headers: noStoreHeaders })
		}

		const { user, valid } = await credentialsProvider.authenticate({
			email: getAdminEmail(),
			password: passcode,
			userAdapter
		})

		if (!valid || !isAuthUser(user)) {
			return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401, headers: noStoreHeaders })
		}

		const session = await sessionAdapter.createSession(String(user.id))
		sessionAdapter.setSessionCookie(cookies, session)

		return json({ ok: true }, { headers: noStoreHeaders })
	} catch {
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
