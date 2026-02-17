import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '@miko/calendar-kit'
import { enforceSameOrigin, requireAdminSession, unauthorized } from '../_helpers.ts'
import {
	parseAdminSyncQueueActionInput,
	processCalendarSyncQueue,
	purgeCalendarSyncDeadLetters,
	retryCalendarSyncDeadLetters,
	TransportValidationError
} from '@miko/calendar'
import { apiError, apiOk, apiValidationError, logApiError } from '@miko/calendar-kit'

export async function POST(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const env = await buildEnv(event.platform)
		const input = parseAdminSyncQueueActionInput(await event.request.json().catch(() => null))
		if (input.action === 'retry_dead_letters') {
			const result = await retryCalendarSyncDeadLetters(env.DB, input.limit)
			return apiOk({ action: input.action, ...result })
		}
		if (input.action === 'purge_dead_letters') {
			const result = await purgeCalendarSyncDeadLetters(env.DB, input.limit)
			return apiOk({ action: input.action, ...result })
		}
		const result = await processCalendarSyncQueue(env.DB, env, input.limit)
		return apiOk({ action: input.action, ...result })
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return apiValidationError(err)
		}
		logApiError('admin.sync-queue', err)
		return apiError('Internal server error')
	}
}
