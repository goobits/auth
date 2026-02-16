import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../../calendar/_bridge.ts'
import { processCalendarSyncQueue } from '$lib/server/calendar-sync-queue'

function unauthorized() {
	return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 })
}

export async function POST(event: RequestEvent) {
	try {
		const env = await buildEnv(event.platform)
		const configured = String(env['CALENDAR_SYNC_CRON_SECRET'] || env['ADMIN_PASSCODE'] || '')
		if (!configured) return unauthorized()

		const authHeader = event.request.headers.get('authorization') || ''
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
		if (!token || token !== configured) return unauthorized()

		const body = await event.request.json().catch(() => null)
		const limit = Math.max(1, Math.min(50, Number.parseInt(String(body?.limit ?? 10), 10) || 10))
		const result = await processCalendarSyncQueue(env.DB, env, limit)
		return json({ ok: true, ...result })
	} catch (error) {
		console.error('Internal calendar sync runner failed:', error)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500 })
	}
}
