import { json, type RequestEvent } from '@sveltejs/kit'
import { getAdminAuth } from '$lib/auth/admin.ts'
import { ADMIN_COOKIE_NAME } from '@packages/calendar/src/admin/auth.ts'

export async function requireAdminSession({ event }: { event: RequestEvent }) {
	const { sessionAdapter } = await getAdminAuth({ event })
	const token = event.cookies.get(ADMIN_COOKIE_NAME)
	if (!token) return { ok: false }
	const { session, user } = await sessionAdapter.validateSession(token)
	if (!session) return { ok: false }
	if (session.fresh) {
		sessionAdapter.setSessionCookie(event.cookies, session)
	}
	return { ok: true, session, user }
}

export const noStoreHeaders = {
	'Cache-Control': 'no-store, max-age=0'
}

export function unauthorized() {
	return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401, headers: noStoreHeaders })
}

export function forbidden() {
	return json({ ok: false, error: { message: 'Forbidden' } }, { status: 403, headers: noStoreHeaders })
}

function isSameOrigin(event: RequestEvent) {
	const origin = event.request.headers.get('origin')
	if (origin) return origin === event.url.origin

	const referer = event.request.headers.get('referer')
	if (referer) {
		try {
			return new URL(referer).origin === event.url.origin
		} catch {
			return false
		}
	}

	// Neither header present — reject by default
	return false
}

export function enforceSameOrigin(event: RequestEvent) {
	if (!isSameOrigin(event)) {
		return forbidden()
	}
	return null
}

export function logAdminEvent(event: RequestEvent, action: string, meta: Record<string, unknown> = {}) {
	const ip =
		event.getClientAddress?.() ||
		event.request?.headers?.get('cf-connecting-ip') ||
		event.request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		'unknown'
	console.info(`[admin] ${action}`, { ip, ...meta })
}
