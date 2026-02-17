import type { RequestEvent } from '@sveltejs/kit'
import { apiError, noStoreHeaders as sharedNoStoreHeaders } from '$lib/server/http/api'

export const noStoreHeaders = sharedNoStoreHeaders

export function requireAdminSession({ event }: { event: RequestEvent }) {
	const locals = event.locals as { user?: unknown; session?: unknown }
	return { ok: !!(locals.session && locals.user) }
}

export function unauthorized() {
	return apiError('Unauthorized', { status: 401 })
}

export function forbidden() {
	return apiError('Forbidden', { status: 403 })
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
