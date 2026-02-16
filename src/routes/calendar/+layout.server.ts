type CalendarUser = {
	avatarUrl?: string
	avatar?: string
	[key: string]: unknown
}

import { buildEnv } from '../api/calendar/_bridge.ts'
import { getEnabledCalendarPrograms } from '@packages/calendar/src/services/programs.ts'

export async function load({ locals, platform }: { locals: { user?: CalendarUser }; platform: App.Platform }) {
	const rawUser = locals.user
	const user = rawUser
		? { ...rawUser, avatarUrl: rawUser.avatarUrl || rawUser.avatar }
		: null
	const env = await buildEnv(platform)
	const activities = await getEnabledCalendarPrograms(env.DB)
	return {
		user,
		activities
	}
}
