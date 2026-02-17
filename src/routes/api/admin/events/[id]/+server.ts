import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../../calendar/_bridge.ts'
import { setAttendanceStatus, updateEventCapacity, updateEventMemory } from '@packages/calendar/src/services/social.ts'
import { parseAdminEventUpdateInput, TransportValidationError } from '@packages/calendar/src/index.ts'
import { enforceSameOrigin, logAdminEvent, requireAdminSession, unauthorized } from '../../_helpers.ts'
import { apiOk, apiError, apiValidationError, logApiError } from '$lib/server/http/api'

export async function POST(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf
		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const eventParam = event.params['id']
		if (!eventParam) {
			return apiError('Missing event id', { status: 400 })
		}
		const eventId = Number.parseInt(eventParam, 10)
		if (!Number.isFinite(eventId) || eventId <= 0) {
			return apiError('Invalid event id', { status: 400 })
		}

		const env = await buildEnv(event.platform)
		const input = parseAdminEventUpdateInput(await event.request.json().catch(() => null))
		if (input.action === 'capacity') {
			await updateEventCapacity(env.DB, { eventId, capacity: input.capacity })
			logAdminEvent(event, 'event_capacity_update', { eventId, capacity: input.capacity })
			return apiOk({})
		}

		if (input.action === 'attendance') {
			await setAttendanceStatus(env.DB, { eventId, userId: input.userId, attendanceStatus: input.attendanceStatus })
			logAdminEvent(event, 'event_attendance_update', { eventId, userId: input.userId, attendanceStatus: input.attendanceStatus })
			return apiOk({})
		}

		if (input.action === 'memory') {
			await updateEventMemory(env.DB, {
				eventId,
				recapText: input.recapText,
				heroImageUrl: input.heroImageUrl
			})
			logAdminEvent(event, 'event_memory_update', { eventId })
			return apiOk({})
		}

		return apiError('Unknown action', { status: 400 })
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return apiValidationError(err)
		}
		logApiError('admin.events.update', err)
		return apiError('Internal server error')
	}
}
