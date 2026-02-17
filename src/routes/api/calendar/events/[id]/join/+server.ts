import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../../_bridge.ts'
import { enqueueCalendarSyncJob, joinEvent, parseCalendarJoinEventInput, processCalendarSyncQueue, TransportValidationError } from '@miko/calendar'
import { getCalendarUserId, unauthorizedCalendar } from '../../../_auth.ts'
import { apiError, apiOk, apiValidationError, logApiError } from '$lib/server/http/api'

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
			return apiError(result.message, { status: 404, code: result.code })
		}
		return apiOk({ status: result.status, state: result.state })
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return apiValidationError(err)
		}
		logApiError('calendar.events.join', err)
		return apiError('Internal server error')
	}
}
