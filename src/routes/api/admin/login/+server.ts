import { json, type RequestEvent } from '@sveltejs/kit'
import { getAdminAuth, ensureAdminAccount, getAdminEmail } from '$lib/auth/admin.ts'
import { checkRateLimit } from '@packages/calendar/src/index.ts'
import { enforceSameOrigin, logAdminEvent, noStoreHeaders } from '../_helpers.ts'

type AuthUser = { id: string | number }

function isAuthUser(value: unknown): value is AuthUser {
	if (!value || typeof value !== 'object') return false
	const id = (value as AuthUser).id
	return typeof id === 'string' || typeof id === 'number'
}

export async function POST(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const { request, platform, cookies } = event
		const { userAdapter, sessionAdapter, credentialsProvider, env, db } = await getAdminAuth({ event: { platform } })
		await ensureAdminAccount({ userAdapter, env })

		const ip = event.getClientAddress?.() || request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
		try {
			const rate = await checkRateLimit({ db, key: `rate:admin_login:${ip}`, limit: 10, windowSeconds: 60 })
			if (!rate.allowed) {
				return json({ ok: false, error: { message: 'Too many requests' } }, { status: 429, headers: noStoreHeaders })
			}
		} catch (err) {
			console.error('[admin] rate limit check failed:', err)
		}

		const body = await request.json().catch(() => null)
		const passcode = body?.passcode
		if (!passcode) {
			logAdminEvent(event, 'login_failed', { reason: 'missing_passcode' })
			return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401, headers: noStoreHeaders })
		}

		const { user, valid } = await credentialsProvider.authenticate({
			email: getAdminEmail(),
			password: passcode,
			userAdapter
		})

		if (!valid || !isAuthUser(user)) {
			logAdminEvent(event, 'login_failed', { reason: 'invalid_credentials' })
			return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401, headers: noStoreHeaders })
		}

		const session = await sessionAdapter.createSession(String(user.id))
		sessionAdapter.setSessionCookie(cookies, session)

		logAdminEvent(event, 'login_success', { userId: user.id })
		return json({ ok: true }, { headers: noStoreHeaders })
	} catch {
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
