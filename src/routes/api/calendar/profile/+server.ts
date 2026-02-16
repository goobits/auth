import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../_bridge.ts'
import { getCalendarProfile, saveCalendarProfile } from '$lib/server/calendar-social'
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
		const body = await event.request.json().catch(() => null)
		if (!body || typeof body !== 'object') {
			return json({ ok: false, error: { message: 'Invalid JSON' } }, { status: 400, headers: noStoreHeaders })
		}

		const env = await buildEnv(event.platform)
		await saveCalendarProfile(env.DB, userId, {
			emergencyContact: String(body.emergencyContact ?? '').slice(0, 120),
			dietaryRestrictions: String(body.dietaryRestrictions ?? '').slice(0, 240),
			chatHandle: String(body.chatHandle ?? '').slice(0, 80)
		})
		return json({ ok: true }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Calendar profile save error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}

