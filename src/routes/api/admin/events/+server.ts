import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.ts'
import { createEventsBatch, listEventsFeed } from '@packages/calendar/src/services/social.ts'
import { enforceSameOrigin, logAdminEvent, requireAdminSession, unauthorized } from '../_helpers.ts'
import { getCalendarProgramBySlug } from '@packages/calendar/src/services/programs.ts'
import { parseAdminCreateEventsBatchInput, TransportValidationError } from '@packages/calendar/src/index.ts'
import { apiOk, apiError, apiValidationError, logApiError } from '$lib/server/http/api'

export async function GET(event: RequestEvent) {
	try {
		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()
		const env = await buildEnv(event.platform)
		const feed = await listEventsFeed(env.DB, '__admin__', false)
		return apiOk({ upcoming: feed.upcoming, recent: feed.recent })
	} catch (err) {
		logApiError('admin.events.list', err)
		return apiError('Internal server error')
	}
}

export async function POST(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const input = parseAdminCreateEventsBatchInput(await event.request.json().catch(() => null))

		const env = await buildEnv(event.platform)
		const program = await getCalendarProgramBySlug(env.DB, input.activitySlug, { includeDisabled: true })
		if (!program) {
			return apiError('Program not found', { status: 404 })
		}
		const ids = await createEventsBatch(env.DB, {
			activitySlug: program.slug,
			title: input.title,
			startsAt: input.startsAt,
			endsAt: input.endsAt,
			capacity: input.capacity,
			costCents: input.costCents,
			currency: input.currency,
			paymentProvider: input.paymentProvider,
			paymentHandle: input.paymentHandle,
			paymentNoteTemplate: input.paymentNoteTemplate,
			location: input.location,
			note: input.note,
			repeatWeeks: input.repeatWeeks
		})

		logAdminEvent(event, 'events_create_batch', { count: ids.length, activitySlug: input.activitySlug })
		return apiOk({ ids })
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return apiValidationError(err)
		}
		logApiError('admin.events.create', err)
		return apiError('Internal server error')
	}
}
