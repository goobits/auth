import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '@miko/calendar-kit'
import { getCalendarProfile, parseCalendarProfileInput, saveCalendarProfile, TransportValidationError } from '@miko/calendar'
import { apiError, apiOk, apiValidationError, getCalendarUserId, logApiError, unauthorizedCalendar } from '@miko/calendar-kit'

export async function GET(event: RequestEvent) {
	try {
		const userId = getCalendarUserId(event)
		if (!userId) return unauthorizedCalendar()
		const env = await buildEnv(event.platform)
		const profile = await getCalendarProfile(env.DB, userId)
		return apiOk({ profile })
	} catch (err) {
		logApiError('calendar.profile.get', err)
		return apiError('Internal server error')
	}
}

export async function POST(event: RequestEvent) {
	try {
		const userId = getCalendarUserId(event)
		if (!userId) return unauthorizedCalendar()
		const input = parseCalendarProfileInput(await event.request.json().catch(() => null))

		const env = await buildEnv(event.platform)
		await saveCalendarProfile(env.DB, userId, {
			emergencyContact: input.emergencyContact,
			dietaryRestrictions: input.dietaryRestrictions,
			chatHandle: input.chatHandle
		})
		return apiOk({})
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return apiValidationError(err)
		}
		logApiError('calendar.profile.save', err)
		return apiError('Internal server error')
	}
}
