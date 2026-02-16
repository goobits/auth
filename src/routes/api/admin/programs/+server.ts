import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.ts'
import { getCalendarPrograms, setCalendarProgramEnabled } from '$lib/server/calendar-programs'
import { isKnownProgramSlug } from '$lib/booking/programs'
import { enforceSameOrigin, logAdminEvent, requireAdminSession, unauthorized, noStoreHeaders } from '../_helpers.ts'

export async function GET(event: RequestEvent) {
	try {
		const env = await buildEnv(event.platform)
		const auth = await requireAdminSession({ event })
		if (!auth.ok) {
			return unauthorized()
		}

		const programs = await getCalendarPrograms(env.DB)
		return json({ ok: true, programs }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin programs load error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}

export async function POST(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const env = await buildEnv(event.platform)
		const auth = await requireAdminSession({ event })
		if (!auth.ok) {
			return unauthorized()
		}

		const body = await event.request.json().catch(() => null)
		if (!body || typeof body !== 'object') {
			return json({ ok: false, error: { message: 'Invalid JSON' } }, { status: 400, headers: noStoreHeaders })
		}

		const slug = typeof body.slug === 'string' ? body.slug : ''
		const enabled = body.enabled
		if (!isKnownProgramSlug(slug) || typeof enabled !== 'boolean') {
			return json({ ok: false, error: { message: 'Invalid program input' } }, { status: 400, headers: noStoreHeaders })
		}

		await setCalendarProgramEnabled(env.DB, slug, enabled)
		logAdminEvent(event, 'program_toggle', { slug, enabled })
		return json({ ok: true }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin programs update error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}

