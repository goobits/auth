import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../../_bridge.ts'
import { leaveEvent } from '@packages/calendar/src/services/social.ts'
import { enqueueCalendarSyncJob, processCalendarSyncQueue } from '@packages/calendar/src/services/sync-queue.ts'
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

		const env = await buildEnv(event.platform)
		await leaveEvent(env.DB, { eventId, userId })
		// Don't block member experience if queue write fails.
		try {
			await enqueueCalendarSyncJob(env.DB, {
				eventId,
				trigger: 'member_leave',
				requestedByUserId: userId
			})
			void processCalendarSyncQueue(env.DB, env, 2).catch((error) => {
				console.warn('Best-effort calendar sync processing failed after leave:', error)
			})
		} catch (error) {
			console.warn('Failed to enqueue calendar sync after leave:', error)
		}
		return json({ ok: true }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Calendar leave event error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
