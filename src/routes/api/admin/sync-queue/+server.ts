import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.ts'
import { enforceSameOrigin, noStoreHeaders, requireAdminSession, unauthorized } from '../_helpers.ts'
import {
	parseAdminSyncQueueActionInput,
	processCalendarSyncQueue,
	purgeCalendarSyncDeadLetters,
	retryCalendarSyncDeadLetters,
	TransportValidationError
} from '@packages/calendar/src/index.ts'

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
			return json({ ok: true, action: input.action, ...result }, { headers: noStoreHeaders })
		}
		if (input.action === 'purge_dead_letters') {
			const result = await purgeCalendarSyncDeadLetters(env.DB, input.limit)
			return json({ ok: true, action: input.action, ...result }, { headers: noStoreHeaders })
		}
		const result = await processCalendarSyncQueue(env.DB, env, input.limit)
		return json({ ok: true, action: input.action, ...result }, { headers: noStoreHeaders })
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return json({ ok: false, error: { message: err.message } }, { status: err.status, headers: noStoreHeaders })
		}
		console.error('Admin sync queue error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
