import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '@miko/calendar-kit'
import { parseAdminRulesInput, TransportValidationError } from '@miko/calendar'
import { enforceSameOrigin, logAdminEvent, requireAdminSession, unauthorized } from '../_helpers.ts'
import { apiError, apiOk, apiValidationError, logApiError } from '@miko/calendar-kit'

export async function POST(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const env = await buildEnv(event.platform)
		const auth = await requireAdminSession({ event })
		if (!auth.ok) {
			return unauthorized()
		}
		const db = env.DB

		const { hoursFrom, hoursTo, buffer, notice, capacity } = parseAdminRulesInput(
			await event.request.json().catch(() => null)
		)
		const now = Date.now()

		// Save each setting
		const settings = [
			['hoursFrom', hoursFrom],
			['hoursTo', hoursTo],
			['buffer', String(buffer)],
			['notice', String(notice)],
			['capacity', String(capacity)]
		]

		for (const [key, value] of settings) {
			await db.prepare(
				`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
				 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
			).bind(key, value, now).run()
		}

		logAdminEvent(event, 'rules_update', { hoursFrom, hoursTo, buffer, notice, capacity })
		return apiOk({})
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return apiValidationError(err)
		}
		logApiError('admin.rules.save', err)
		return apiError('Internal server error')
	}
}
