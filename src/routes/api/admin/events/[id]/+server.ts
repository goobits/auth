import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../../calendar/_bridge.ts'
import { setAttendanceStatus, updateEventCapacity, updateEventMemory } from '@packages/calendar/src/services/social.ts'
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

		const body = await event.request.json().catch(() => null)
		if (!body || typeof body !== 'object') {
			return json({ ok: false, error: { message: 'Invalid JSON' } }, { status: 400, headers: noStoreHeaders })
		}

		const env = await buildEnv(event.platform)
		const action = typeof body.action === 'string' ? body.action : ''
		if (action === 'capacity') {
			const capacity = Number.parseInt(String(body.capacity ?? 0), 10)
			if (!Number.isFinite(capacity) || capacity < 1 || capacity > 50) {
				return json({ ok: false, error: { message: 'Invalid capacity' } }, { status: 400, headers: noStoreHeaders })
			}
			await updateEventCapacity(env.DB, { eventId, capacity })
			logAdminEvent(event, 'event_capacity_update', { eventId, capacity })
			return json({ ok: true }, { headers: noStoreHeaders })
		}

		if (action === 'attendance') {
			const userId = typeof body.userId === 'string' ? body.userId : ''
			const attendanceStatus = body.attendanceStatus
			if (!userId || (attendanceStatus !== 'unknown' && attendanceStatus !== 'attended' && attendanceStatus !== 'flaked')) {
				return json({ ok: false, error: { message: 'Invalid attendance input' } }, { status: 400, headers: noStoreHeaders })
			}
			await setAttendanceStatus(env.DB, { eventId, userId, attendanceStatus })
			logAdminEvent(event, 'event_attendance_update', { eventId, userId, attendanceStatus })
			return json({ ok: true }, { headers: noStoreHeaders })
		}

		if (action === 'memory') {
			const recapText = typeof body.recapText === 'string' ? body.recapText.slice(0, 400) : ''
			const heroImageUrl = typeof body.heroImageUrl === 'string' ? body.heroImageUrl.slice(0, 240) : ''
			await updateEventMemory(env.DB, {
				eventId,
				recapText: recapText || null,
				heroImageUrl: heroImageUrl || null
			})
			logAdminEvent(event, 'event_memory_update', { eventId })
			return json({ ok: true }, { headers: noStoreHeaders })
		}

		return json({ ok: false, error: { message: 'Unknown action' } }, { status: 400, headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin event update error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
