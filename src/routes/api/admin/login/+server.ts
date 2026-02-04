import { json } from '@sveltejs/kit'
import { getAdminAuth, ensureAdminAccount, getAdminEmail } from '$lib/auth/admin.ts'
import { checkRateLimit } from '@packages/calendar/src/index.ts'
import { noStoreHeaders } from '../_helpers.ts'

export async function POST(event: any) {
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
		} catch (rateErr) {
			console.warn('Admin login rate limit unavailable:', rateErr)
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

		if (!valid || !user) {
			return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401, headers: noStoreHeaders })
		}

		const session = await sessionAdapter.createSession(String((user as any).id))
		sessionAdapter.setSessionCookie(cookies, session)

		return json({ ok: true }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin login error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
