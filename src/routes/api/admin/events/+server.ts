import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.ts'
import { createEventsBatch, listEventsFeed } from '$lib/server/calendar-social'
import { enforceSameOrigin, logAdminEvent, noStoreHeaders, requireAdminSession, unauthorized } from '../_helpers.ts'
import { getCalendarProgramBySlug } from '$lib/server/calendar-programs'

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

		const body = await event.request.json().catch(() => null)
		if (!body || typeof body !== 'object') {
			return json({ ok: false, error: { message: 'Invalid JSON' } }, { status: 400, headers: noStoreHeaders })
		}
		const activitySlug = typeof body.activitySlug === 'string' ? body.activitySlug : ''
		const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : ''
		const startsAt = typeof body.startsAt === 'string' ? body.startsAt : ''
		const endsAt = typeof body.endsAt === 'string' ? body.endsAt : ''
		const capacity = Number.parseInt(String(body.capacity ?? 1), 10)
		const repeatWeeks = Number.parseInt(String(body.repeatWeeks ?? 0), 10)
		const costCents = Number.parseInt(String(body.costCents ?? 0), 10)
		const currency = typeof body.currency === 'string' ? body.currency.toUpperCase().slice(0, 8) : 'USD'
		const paymentProviderRaw = typeof body.paymentProvider === 'string' ? body.paymentProvider.toLowerCase().slice(0, 32) : ''
		const paymentProvider = paymentProviderRaw || null
		const paymentHandle = typeof body.paymentHandle === 'string' ? body.paymentHandle.trim().slice(0, 80) : null
		const paymentNoteTemplate = typeof body.paymentNoteTemplate === 'string' ? body.paymentNoteTemplate.trim().slice(0, 120) : null

		if (!title || !startsAt || !endsAt || !Number.isFinite(capacity) || capacity < 1 || capacity > 50) {
			return json({ ok: false, error: { message: 'Invalid event input' } }, { status: 400, headers: noStoreHeaders })
		}
		if (!Number.isFinite(costCents) || costCents < 0 || costCents > 200000) {
			return json({ ok: false, error: { message: 'Invalid cost' } }, { status: 400, headers: noStoreHeaders })
		}

		if (!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(startsAt)) {
			return json({ ok: false, error: { message: 'Invalid event times' } }, { status: 400, headers: noStoreHeaders })
		}

		const env = await buildEnv(event.platform)
		const program = await getCalendarProgramBySlug(env.DB, activitySlug, { includeDisabled: true })
		if (!program) {
			return json({ ok: false, error: { message: 'Program not found' } }, { status: 404, headers: noStoreHeaders })
		}
		const ids = await createEventsBatch(env.DB, {
			activitySlug: program.slug,
			title,
			startsAt,
			endsAt,
			capacity,
			costCents: Number.isFinite(costCents) ? costCents : 0,
			currency,
			paymentProvider,
			paymentHandle,
			paymentNoteTemplate,
			location: typeof body.location === 'string' ? body.location.slice(0, 120) : null,
			note: typeof body.note === 'string' ? body.note.slice(0, 300) : null,
			repeatWeeks: Number.isFinite(repeatWeeks) ? repeatWeeks : 0
		})

		logAdminEvent(event, 'events_create_batch', { count: ids.length, activitySlug })
		return json({ ok: true, ids }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin events create error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
