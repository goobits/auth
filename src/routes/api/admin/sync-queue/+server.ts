import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.ts'
import { enforceSameOrigin, noStoreHeaders, requireAdminSession, unauthorized } from '../_helpers.ts'
import { processCalendarSyncQueue } from '$lib/server/calendar-sync-queue'

export async function POST(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const env = await buildEnv(event.platform)
		const body = await event.request.json().catch(() => null)
		const limit = Math.max(1, Math.min(50, Number.parseInt(String(body?.limit ?? 10), 10) || 10))
		const result = await processCalendarSyncQueue(env.DB, env, limit)
		return json({ ok: true, ...result }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin sync queue error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
