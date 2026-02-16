import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../calendar/_bridge.ts'
import { deleteCalendarProgram, getCalendarPrograms, upsertCalendarProgram } from '@packages/calendar/src/services/programs.ts'
import { parseAdminProgramMutationInput, TransportValidationError } from '@packages/calendar/src/index.ts'
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

		const input = parseAdminProgramMutationInput(await event.request.json().catch(() => null))

		if (input.action === 'delete') {
			const slug = input.slug
			await deleteCalendarProgram(env.DB, slug)
			logAdminEvent(event, 'program_delete', { slug })
			return json({ ok: true }, { headers: noStoreHeaders })
		}

		if (input.action === 'toggle') {
			const slug = input.slug
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
				enabled: input.enabled,
				sortOrder: target.sortOrder
			})
			logAdminEvent(event, 'program_toggle', { slug, enabled: input.enabled })
			return json({ ok: true }, { headers: noStoreHeaders })
		}

		const program = input.program

		await upsertCalendarProgram(env.DB, {
			...program
		})
		logAdminEvent(event, 'program_upsert', { slug: program.slug, enabled: program.enabled })
		return json({ ok: true }, { headers: noStoreHeaders })
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return json({ ok: false, error: { message: err.message } }, { status: err.status, headers: noStoreHeaders })
		}
		console.error('Admin programs update error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
