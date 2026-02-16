import { error } from '@sveltejs/kit'
import { buildEnv } from '../../api/calendar/_bridge.ts'
import { getCalendarProgramBySlug } from '$lib/server/calendar-programs'

export async function load({ platform, params }: { platform: App.Platform; params: { slug: string } }) {
	const env = await buildEnv(platform)
	const activity = await getCalendarProgramBySlug(env.DB, params.slug)
	if (!activity) {
		throw error(404, 'Program not found')
	}
	return { activity }
}

