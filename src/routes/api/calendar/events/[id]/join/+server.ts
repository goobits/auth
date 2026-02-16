import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../../_bridge.ts'
import { joinEvent } from '$lib/server/calendar-social'
import { enqueueCalendarSyncJob } from '$lib/server/calendar-sync-queue'
import { getCalendarUserId, noStoreHeaders, unauthorizedCalendar } from '../../../_auth.ts'

export async function POST(event: RequestEvent) {
	try {
		const userId = getCalendarUserId(event)
		if (!userId) return unauthorizedCalendar()

		const eventParam = event.params['id']
		if (!eventParam) {
			return json({ ok: false, error: { message: 'Missing event id' } }, { status: 400, headers: noStoreHeaders })
		}
		const eventId = Number.parseInt(eventParam, 10)
		if (!Number.isFinite(eventId) || eventId <= 0) {
			return json({ ok: false, error: { message: 'Invalid event id' } }, { status: 400, headers: noStoreHeaders })
		}

		const body = await event.request.json().catch(() => null)
		const guestCount = Number.parseInt(String(body?.guestCount ?? 0), 10)
		const note = typeof body?.note === 'string' ? body.note.slice(0, 400) : null

		const env = await buildEnv(event.platform)
		const result = await joinEvent(env.DB, {
			eventId,
			userId,
			guestCount: Number.isFinite(guestCount) ? guestCount : 0,
			note
		})
		// Don't block member experience if queue write fails.
		try {
			await enqueueCalendarSyncJob(env.DB, {
				eventId,
				trigger: 'member_join',
				requestedByUserId: userId,
				payload: { guestCount: Number.isFinite(guestCount) ? guestCount : 0 }
			})
		} catch (error) {
			console.warn('Failed to enqueue calendar sync after join:', error)
		}

		if (!result.ok) {
			return json({ ok: false, error: { message: result.message, code: result.code } }, { status: 404, headers: noStoreHeaders })
		}
		return json({ ok: true, status: result.status }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Calendar join event error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
