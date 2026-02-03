import { json } from '@sveltejs/kit'
import { getAdminSessionCookie, parseAdminSessionCookie, validateAdminSession } from '../../../../packages/calendar/src/admin/session.js'

const DEFAULT_ROTATE_DAYS = 14

function getTtlSeconds(env) {
	if (env.ADMIN_SESSION_TTL_DAYS) {
		const days = Number.parseInt(env.ADMIN_SESSION_TTL_DAYS, 10)
		return Number.isFinite(days) ? days * 24 * 60 * 60 : 60 * 24 * 60 * 60
	}
	if (env.ADMIN_SESSION_TTL_SECONDS) {
		const seconds = Number.parseInt(env.ADMIN_SESSION_TTL_SECONDS, 10)
		return Number.isFinite(seconds) ? seconds : 60 * 24 * 60 * 60
	}
	return 60 * 24 * 60 * 60
}

function getRotateSeconds(env) {
	const raw = env.ADMIN_SESSION_ROTATE_DAYS || String(DEFAULT_ROTATE_DAYS)
	const days = Number.parseInt(raw, 10)
	return Number.isFinite(days) ? days * 24 * 60 * 60 : DEFAULT_ROTATE_DAYS * 24 * 60 * 60
}

export async function requireAdminSession({ env, request }) {
	const token = parseAdminSessionCookie(request.headers.get('cookie'))
	if (!token) return { ok: false }
	const ttlSeconds = getTtlSeconds(env)
	const rotateAfterSeconds = getRotateSeconds(env)
	const result = await validateAdminSession({ db: env.DB, token, ttlSeconds, rotateAfterSeconds })
	if (!result?.valid) return { ok: false }
	if (result.rotated) {
		const secure = env.NODE_ENV !== 'development'
		const cookie = getAdminSessionCookie(token, result.expiresAt, { secure })
		return { ok: true, setCookie: cookie }
	}
	return { ok: true }
}

export function unauthorized() {
	return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 })
}
