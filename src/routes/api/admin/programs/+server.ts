import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.ts'
import { deleteCalendarProgram, getCalendarPrograms, upsertCalendarProgram } from '$lib/server/calendar-programs'
import { isValidProgramSlug } from '$lib/booking/programs'
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
		const action = typeof body.action === 'string' ? body.action : ''

		if (action === 'delete') {
			const slug = typeof body.slug === 'string' ? body.slug : ''
			if (!isValidProgramSlug(slug)) {
				return json({ ok: false, error: { message: 'Invalid program slug' } }, { status: 400, headers: noStoreHeaders })
			}
			await deleteCalendarProgram(env.DB, slug)
			logAdminEvent(event, 'program_delete', { slug })
			return json({ ok: true }, { headers: noStoreHeaders })
		}

		// Backwards compatibility for toggle requests.
		if (action === 'toggle' || (!action && typeof body.enabled === 'boolean')) {
			const slug = typeof body.slug === 'string' ? body.slug : ''
			if (!isValidProgramSlug(slug)) {
				return json({ ok: false, error: { message: 'Invalid program slug' } }, { status: 400, headers: noStoreHeaders })
			}
			const existing = await getCalendarPrograms(env.DB)
			const target = existing.find((program) => program.slug === slug)
			if (!target) {
				return json({ ok: false, error: { message: 'Program not found' } }, { status: 404, headers: noStoreHeaders })
			}
			await upsertCalendarProgram(env.DB, {
				slug: target.slug,
				label: target.label,
				activityName: target.activityName,
				pageTitle: target.pageTitle,
				eyebrow: target.eyebrow,
				heroTitleLine1: target.heroTitleLines[0],
				heroTitleLine2: target.heroTitleLines.length > 1 ? (target.heroTitleLines[1] ?? null) : null,
				heroSubtitle: target.heroSubtitle,
				description: target.description,
				icon: target.icon,
				eyebrowClass: target.eyebrowClass ?? null,
				glowClass: target.glowClass ?? null,
				formGlowClass: target.formGlowClass ?? null,
				serviceStatusNote: target.serviceStatusNote ?? null,
				enabled: Boolean(body.enabled),
				sortOrder: target.sortOrder
			})
			logAdminEvent(event, 'program_toggle', { slug, enabled: Boolean(body.enabled) })
			return json({ ok: true }, { headers: noStoreHeaders })
		}

		const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
		if (!isValidProgramSlug(slug)) {
			return json({ ok: false, error: { message: 'Invalid program slug' } }, { status: 400, headers: noStoreHeaders })
		}
		const label = typeof body.label === 'string' ? body.label.trim().slice(0, 40) : ''
		const activityName = typeof body.activityName === 'string' ? body.activityName.trim().slice(0, 80) : ''
		const pageTitle = typeof body.pageTitle === 'string' ? body.pageTitle.trim().slice(0, 120) : ''
		const eyebrow = typeof body.eyebrow === 'string' ? body.eyebrow.trim().slice(0, 60) : ''
		const heroTitleLine1 = typeof body.heroTitleLine1 === 'string' ? body.heroTitleLine1.trim().slice(0, 80) : ''
		const heroTitleLine2 = typeof body.heroTitleLine2 === 'string' ? body.heroTitleLine2.trim().slice(0, 80) : ''
		const heroSubtitle = typeof body.heroSubtitle === 'string' ? body.heroSubtitle.trim().slice(0, 180) : ''
		const description = typeof body.description === 'string' ? body.description.trim().slice(0, 180) : ''
		const icon = typeof body.icon === 'string' ? body.icon.trim().slice(0, 16) : ''
		const sortOrder = Number.parseInt(String(body.sortOrder ?? 0), 10)
		const enabled = Boolean(body.enabled)
		if (!label || !activityName || !pageTitle || !eyebrow || !heroTitleLine1 || !heroSubtitle || !description || !icon) {
			return json({ ok: false, error: { message: 'Missing required program fields' } }, { status: 400, headers: noStoreHeaders })
		}

		await upsertCalendarProgram(env.DB, {
			slug,
			label,
			activityName,
			pageTitle,
			eyebrow,
			heroTitleLine1,
			heroTitleLine2: heroTitleLine2 || null,
			heroSubtitle,
			description,
			icon,
			eyebrowClass: typeof body.eyebrowClass === 'string' ? body.eyebrowClass.trim().slice(0, 64) || null : null,
			glowClass: typeof body.glowClass === 'string' ? body.glowClass.trim().slice(0, 64) || null : null,
			formGlowClass: typeof body.formGlowClass === 'string' ? body.formGlowClass.trim().slice(0, 64) || null : null,
			serviceStatusNote: typeof body.serviceStatusNote === 'string' ? body.serviceStatusNote.trim().slice(0, 120) || null : null,
			enabled,
			sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0
		})
		logAdminEvent(event, 'program_upsert', { slug, enabled })
		return json({ ok: true }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Admin programs update error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
