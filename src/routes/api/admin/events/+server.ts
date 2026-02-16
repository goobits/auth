import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.ts'
import { createEventsBatch, listEventsFeed } from '@packages/calendar/src/services/social.ts'
import { enforceSameOrigin, logAdminEvent, noStoreHeaders, requireAdminSession, unauthorized } from '../_helpers.ts'
import { getCalendarProgramBySlug } from '@packages/calendar/src/services/programs.ts'
import { parseAdminCreateEventsBatchInput, TransportValidationError } from '@packages/calendar/src/index.ts'

export async function GET(event: RequestEvent) {
	try {
		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()
		const env = await buildEnv(event.platform)
		const feed = await listEventsFeed(env.DB, '__admin__', false)
		return json({ ok: true, upcoming: feed.upcoming, recent: feed.recent }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin events load error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
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
			return json({ ok: false, error: { message: 'Program not found' } }, { status: 404, headers: noStoreHeaders })
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
		return json({ ok: true, ids }, { headers: noStoreHeaders })
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return json({ ok: false, error: { message: err.message } }, { status: err.status, headers: noStoreHeaders })
		}
		console.error('Admin events create error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
