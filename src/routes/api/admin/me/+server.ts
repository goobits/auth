import { json } from '@sveltejs/kit'
import { getAdminAuth } from '$lib/auth/admin.ts'
import { ADMIN_COOKIE_NAME } from '@packages/calendar/src/admin/auth.ts'
import { noStoreHeaders } from '../_helpers.ts'

export async function GET({ platform, cookies }: { platform: any; cookies: any }) {
	try {
		const { sessionAdapter } = await getAdminAuth({ event: { platform } })
		const token = cookies.get(ADMIN_COOKIE_NAME)
		if (!token) return json({ ok: true, authenticated: false }, { headers: noStoreHeaders })
		const { session } = await sessionAdapter.validateSession(token)
		if (!session) return json({ ok: true, authenticated: false }, { headers: noStoreHeaders })
		if (session.fresh) {
			sessionAdapter.setSessionCookie(cookies, session)
		}
		return json({ ok: true, authenticated: true }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin me error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
