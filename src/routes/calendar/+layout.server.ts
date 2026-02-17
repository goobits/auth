import { buildEnv } from '../api/calendar/_bridge.ts'
import { loadCalendarMemberShellData } from '@packages/calendar/src/index.ts'

type CalendarUser = {
	avatarUrl?: string
	avatar?: string
	[key: string]: unknown
}

export async function load({ locals, platform }: { locals: { user?: CalendarUser }; platform: App.Platform }) {
	const env = await buildEnv(platform)
	return loadCalendarMemberShellData(env.DB, locals.user ? { user: locals.user } : {})
}
