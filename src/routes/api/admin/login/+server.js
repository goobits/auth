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

		const { token, expiresAt } = await createAdminSession({ db: env.DB })
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
