import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../../_bridge.ts'
import { joinEvent } from '@packages/calendar/src/services/social.ts'
import { enqueueCalendarSyncJob, processCalendarSyncQueue } from '@packages/calendar/src/services/sync-queue.ts'
import { parseCalendarJoinEventInput, TransportValidationError } from '@packages/calendar/src/index.ts'
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

		const input = parseCalendarJoinEventInput(await event.request.json().catch(() => null))

		const env = await buildEnv(event.platform)
		const result = await joinEvent(env.DB, {
			eventId,
			userId,
			guestCount: input.guestCount,
			note: input.note
		})
		// Don't block member experience if queue write fails.
		try {
			await enqueueCalendarSyncJob(env.DB, {
				eventId,
				trigger: 'member_join',
				requestedByUserId: userId,
				payload: { guestCount: input.guestCount }
			})
			void processCalendarSyncQueue(env.DB, env, 2).catch((error) => {
				console.warn('Best-effort calendar sync processing failed after join:', error)
			})
		} catch (error) {
			console.warn('Failed to enqueue calendar sync after join:', error)
		}

		if (!result.ok) {
			return json({ ok: false, error: { message: result.message, code: result.code } }, { status: 404, headers: noStoreHeaders })
		}
		return json({ ok: true, status: result.status }, { headers: noStoreHeaders })
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return json({ ok: false, error: { message: err.message } }, { status: err.status, headers: noStoreHeaders })
		}
		console.error('Calendar join event error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
