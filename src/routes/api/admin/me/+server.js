import { json } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.js'
import { getAdminSessionCookie, parseAdminSessionCookie, validateAdminSession } from '../../../../../packages/calendar/src/admin/session.js'

export async function GET({ request, platform }) {
	try {
		const env = await buildEnv(platform)
		const token = parseAdminSessionCookie(request.headers.get('cookie'))
		let ttlSeconds = 60 * 24 * 60 * 60
		if (env.ADMIN_SESSION_TTL_DAYS) {
			const days = Number.parseInt(env.ADMIN_SESSION_TTL_DAYS, 10)
			if (Number.isFinite(days)) ttlSeconds = days * 24 * 60 * 60
		} else if (env.ADMIN_SESSION_TTL_SECONDS) {
			const seconds = Number.parseInt(env.ADMIN_SESSION_TTL_SECONDS, 10)
			if (Number.isFinite(seconds)) ttlSeconds = seconds
		}
		const rotateDays = Number.parseInt(env.ADMIN_SESSION_ROTATE_DAYS || '14', 10)
		const rotateAfterSeconds = Number.isFinite(rotateDays) ? rotateDays * 24 * 60 * 60 : 14 * 24 * 60 * 60
		const result = await validateAdminSession({ db: env.DB, token, ttlSeconds, rotateAfterSeconds })
		const ok = result?.valid ?? false
		if (ok && result.rotated) {
			const secure = env.NODE_ENV !== 'development'
			const cookie = getAdminSessionCookie(token, result.expiresAt, { secure })
			return json({ ok, authenticated: ok }, { headers: { 'Set-Cookie': cookie } })
		}
		return json({ ok, authenticated: ok })
	} catch (err) {
		console.error('Admin me error:', err)
		return json({ ok: false, error: { message: err.message } }, { status: 500 })
	}
}
