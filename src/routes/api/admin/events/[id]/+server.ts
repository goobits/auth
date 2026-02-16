import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../../calendar/_bridge.ts'
import { setAttendanceStatus, updateEventCapacity, updateEventMemory } from '@packages/calendar/src/services/social.ts'
import { parseAdminEventUpdateInput, TransportValidationError } from '@packages/calendar/src/index.ts'
import { enforceSameOrigin, logAdminEvent, noStoreHeaders, requireAdminSession, unauthorized } from '../../_helpers.ts'

export async function POST(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf
		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const eventParam = event.params['id']
		if (!eventParam) {
			return json({ ok: false, error: { message: 'Missing event id' } }, { status: 400, headers: noStoreHeaders })
		}
		const eventId = Number.parseInt(eventParam, 10)
		if (!Number.isFinite(eventId) || eventId <= 0) {
			return json({ ok: false, error: { message: 'Invalid event id' } }, { status: 400, headers: noStoreHeaders })
		}

		const env = await buildEnv(event.platform)
		const input = parseAdminEventUpdateInput(await event.request.json().catch(() => null))
		if (input.action === 'capacity') {
			await updateEventCapacity(env.DB, { eventId, capacity: input.capacity })
			logAdminEvent(event, 'event_capacity_update', { eventId, capacity: input.capacity })
			return json({ ok: true }, { headers: noStoreHeaders })
		}

		if (input.action === 'attendance') {
			await setAttendanceStatus(env.DB, { eventId, userId: input.userId, attendanceStatus: input.attendanceStatus })
			logAdminEvent(event, 'event_attendance_update', { eventId, userId: input.userId, attendanceStatus: input.attendanceStatus })
			return json({ ok: true }, { headers: noStoreHeaders })
		}

		if (input.action === 'memory') {
			await updateEventMemory(env.DB, {
				eventId,
				recapText: input.recapText,
				heroImageUrl: input.heroImageUrl
			})
			logAdminEvent(event, 'event_memory_update', { eventId })
			return json({ ok: true }, { headers: noStoreHeaders })
		}

		return json({ ok: false, error: { message: 'Unknown action' } }, { status: 400, headers: noStoreHeaders })
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return json({ ok: false, error: { message: err.message } }, { status: err.status, headers: noStoreHeaders })
		}
		console.error('Admin event update error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
