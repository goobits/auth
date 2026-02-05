import { json } from '@sveltejs/kit'
import { getAdminAuth } from '$lib/auth/admin.ts'
import { ADMIN_COOKIE_NAME } from '@packages/calendar/src/admin/auth.ts'
import { enforceSameOrigin, logAdminEvent, noStoreHeaders } from '../_helpers.ts'

export async function POST(event: any) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const { sessionAdapter } = await getAdminAuth({ event: { platform: event.platform } })
		const token = event.cookies.get(ADMIN_COOKIE_NAME)
		if (token) {
			await sessionAdapter.invalidateSession(token)
		}
		sessionAdapter.deleteSessionCookie(event.cookies)
		logAdminEvent(event, 'logout')
		return json({ ok: true }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin logout error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
