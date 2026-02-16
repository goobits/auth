import { error } from '@sveltejs/kit'
import { buildEnv } from '../api/calendar/_bridge.ts'
import { isCalendarProgramEnabled } from '$lib/server/calendar-programs'
import type { CalendarProgramSlug } from '$lib/booking/programs'

export async function requireEnabledProgram(platform: App.Platform, slug: CalendarProgramSlug) {
	const env = await buildEnv(platform)
	const enabled = await isCalendarProgramEnabled(env.DB, slug)
	if (!enabled) {
		throw error(404, 'Program not found')
	}
}

