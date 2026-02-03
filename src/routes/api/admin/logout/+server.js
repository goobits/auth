import { json } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.js'
import { clearAdminSessionCookie, deleteAdminSession, parseAdminSessionCookie } from '../../../../../packages/calendar/src/admin/session.js'

export async function POST({ request, platform }) {
	try {
		const env = await buildEnv(platform)
		const token = parseAdminSessionCookie(request.headers.get('cookie'))
		if (token) {
			await deleteAdminSession({ db: env.DB, token })
		}
		const secure = env.NODE_ENV !== 'development'
		const cookie = clearAdminSessionCookie({ secure })
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Set-Cookie': cookie
			}
		})
	} catch (err) {
		console.error('Admin logout error:', err)
		return json({ ok: false, error: { message: err.message } }, { status: 500 })
	}
}
