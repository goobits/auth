import { json } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.js'
import { createAdminSession, getAdminSessionCookie } from '../../../../../packages/calendar/src/admin/session.js'

export async function POST({ request, platform }) {
	try {
		const env = await buildEnv(platform)
		const expected = env.ADMIN_PASSCODE || ''
		if (!expected) {
			return json({ ok: false, error: { message: 'Admin passcode not configured' } }, { status: 500 })
		}

		const { passcode } = await request.json()
		if (!passcode || passcode !== expected) {
			return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 })
		}

		let ttlSeconds = 60 * 24 * 60 * 60
		if (env.ADMIN_SESSION_TTL_DAYS) {
			const days = Number.parseInt(env.ADMIN_SESSION_TTL_DAYS, 10)
			if (Number.isFinite(days)) ttlSeconds = days * 24 * 60 * 60
		} else if (env.ADMIN_SESSION_TTL_SECONDS) {
			const seconds = Number.parseInt(env.ADMIN_SESSION_TTL_SECONDS, 10)
			if (Number.isFinite(seconds)) ttlSeconds = seconds
		}
		const { token, expiresAt } = await createAdminSession({ db: env.DB, ttlSeconds })
		const secure = env.NODE_ENV !== 'development'
		const cookie = getAdminSessionCookie(token, expiresAt, { secure })

		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Set-Cookie': cookie
			}
		})
	} catch (err) {
		console.error('Admin login error:', err)
		return json({ ok: false, error: { message: err.message } }, { status: 500 })
	}
}
