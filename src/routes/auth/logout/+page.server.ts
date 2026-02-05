import { getCalendarAuth } from '$lib/auth/calendar.ts'

export const prerender = false

export const actions = {
	default: async (event: any) => {
		const { auth } = await getCalendarAuth({ event })
		return auth.handlers.logout.default(event)
	}
}
