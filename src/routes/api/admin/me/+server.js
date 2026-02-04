import { json } from '@sveltejs/kit'
import { getAdminAuth } from '$lib/auth/admin.js'

export async function GET({ platform, cookies }) {
	try {
		const { sessionAdapter } = await getAdminAuth({ event: { platform } })
		const token = cookies.get(sessionAdapter.cookieName)
		if (!token) return json({ ok: true, authenticated: false })
		const { session } = await sessionAdapter.validateSession(token)
		if (!session) return json({ ok: true, authenticated: false })
		if (session.fresh) {
			sessionAdapter.setSessionCookie(cookies, session)
		}
		return json({ ok: true, authenticated: true })
	} catch (err) {
		console.error('Admin me error:', err)
		return json({ ok: false, error: { message: err.message } }, { status: 500 })
	}
}
