import { json } from '@sveltejs/kit'
import { getAdminAuth } from '$lib/auth/admin.ts'
import { ADMIN_COOKIE_NAME } from '@packages/calendar/src/admin/auth.ts'

export async function requireAdminSession({ event }: { event: any }) {
	const { sessionAdapter } = await getAdminAuth({ event })
	const token = event.cookies.get(ADMIN_COOKIE_NAME)
	if (!token) return { ok: false }
	const { session } = await sessionAdapter.validateSession(token)
	if (!session) return { ok: false }
	if (session.fresh) {
		sessionAdapter.setSessionCookie(event.cookies, session)
	}
	return { ok: true }
}

export const noStoreHeaders = {
	'Cache-Control': 'no-store, max-age=0'
}

export function unauthorized() {
	return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401, headers: noStoreHeaders })
}
