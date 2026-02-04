import { json } from '@sveltejs/kit'
import { getAdminAuth, ensureAdminAccount, getAdminEmail } from '$lib/auth/admin.js'

export async function POST({ request, platform, cookies }) {
	try {
		const { userAdapter, sessionAdapter, credentialsProvider, env } = await getAdminAuth({ event: { platform } })
		await ensureAdminAccount({ userAdapter, env })

		const { passcode } = await request.json()
		if (!passcode) {
			return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 })
		}

		const { user, valid } = await credentialsProvider.authenticate({
			email: getAdminEmail(),
			password: passcode,
			userAdapter
		})

		if (!valid || !user) {
			return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 })
		}

		const session = await sessionAdapter.createSession(user.id)
		sessionAdapter.setSessionCookie(cookies, session)

		return json({ ok: true })
	} catch (err) {
		console.error('Admin login error:', err)
		return json({ ok: false, error: { message: err.message } }, { status: 500 })
	}
}
