import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../../_bridge.ts'
import { enqueueCalendarSyncJob, leaveEvent, processCalendarSyncQueue } from '@miko/calendar'
import { getCalendarUserId, unauthorizedCalendar } from '../../../_auth.ts'
import { apiError, apiOk, logApiError } from '$lib/server/http/api'

export async function POST(event: RequestEvent) {
	try {
		const userId = getCalendarUserId(event)
		if (!userId) return unauthorizedCalendar()

		const eventParam = event.params['id']
		if (!eventParam) {
			return apiError('Missing event id', { status: 400 })
		}
		const eventId = Number.parseInt(eventParam, 10)
		if (!Number.isFinite(eventId) || eventId <= 0) {
			return apiError('Invalid event id', { status: 400 })
		}

		const env = await buildEnv(event.platform)
		const result = await leaveEvent(env.DB, { eventId, userId })
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
		return apiOk({ state: result.state })
	} catch (err) {
		logApiError('calendar.events.leave', err)
		return apiError('Internal server error')
	}
}
