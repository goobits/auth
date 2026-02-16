import { onRequest } from '../../../../../functions/api/calendar/book.ts'
import { buildEnv } from '../_bridge.ts'
import { getEnabledCalendarProgramByActivityName } from '$lib/server/calendar-programs'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = await buildEnv(platform)
	const cloned = request.clone()
	const body = await cloned.json().catch(() => null) as { activity?: unknown } | null
	const activity = typeof body?.activity === 'string' ? body.activity : ''
	const slug = activity ? await getEnabledCalendarProgramByActivityName(env.DB, activity) : null
	if (activity && !slug) {
		return Response.json(
			{ ok: false, error: { code: 'program_disabled', message: 'This program is currently unavailable.' } },
			{ status: 403 }
		)
	}

	return onRequest({ env, request })
}
