import { json } from '@sveltejs/kit'
import { getAdminAuth } from '$lib/auth/admin.js'

export async function requireAdminSession({ event }) {
	const { sessionAdapter } = await getAdminAuth({ event })
	const token = event.cookies.get(sessionAdapter.cookieName)
	if (!token) return { ok: false }
	const { session } = await sessionAdapter.validateSession(token)
	if (!session) return { ok: false }
	if (session.fresh) {
		sessionAdapter.setSessionCookie(event.cookies, session)
	}
	return { ok: true }
}

export function unauthorized() {
	return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 })
}
