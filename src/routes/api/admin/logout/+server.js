import { json } from '@sveltejs/kit'
import { getAdminAuth } from '$lib/auth/admin.js'

export async function POST({ platform, cookies }) {
	try {
		const { sessionAdapter } = await getAdminAuth({ event: { platform } })
		const token = cookies.get(sessionAdapter.cookieName)
		if (token) {
			await sessionAdapter.invalidateSession(token)
		}
		sessionAdapter.deleteSessionCookie(cookies)
		return json({ ok: true })
	} catch (err) {
		console.error('Admin logout error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500 })
	}
}
