import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../_bridge.ts'
import { getCalendarProfile, saveCalendarProfile } from '@packages/calendar/src/services/social.ts'
import { parseCalendarProfileInput, TransportValidationError } from '@packages/calendar/src/index.ts'
import { getCalendarUserId, noStoreHeaders, unauthorizedCalendar } from '../_auth.ts'

export async function GET(event: RequestEvent) {
	try {
		const userId = getCalendarUserId(event)
		if (!userId) return unauthorizedCalendar()
		const env = await buildEnv(event.platform)
		const profile = await getCalendarProfile(env.DB, userId)
		return json({ ok: true, profile }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Calendar profile load error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
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
		return json({ ok: true }, { headers: noStoreHeaders })
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return json({ ok: false, error: { message: err.message } }, { status: err.status, headers: noStoreHeaders })
		}
		console.error('Calendar profile save error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
