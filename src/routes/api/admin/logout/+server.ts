import { json } from '@sveltejs/kit'
import { getAdminAuth } from '$lib/auth/admin.ts'
import { ADMIN_COOKIE_NAME } from '@packages/calendar/src/admin/auth.ts'
import { noStoreHeaders } from '../_helpers.ts'

export async function POST({ platform, cookies }: { platform: any; cookies: any }) {
	try {
		const { sessionAdapter } = await getAdminAuth({ event: { platform } })
		const token = cookies.get(ADMIN_COOKIE_NAME)
		if (token) {
			await sessionAdapter.invalidateSession(token)
		}
		sessionAdapter.deleteSessionCookie(cookies)
		return json({ ok: true }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin logout error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
