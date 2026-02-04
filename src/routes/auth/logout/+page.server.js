import { getCalendarAuth } from '$lib/auth/calendar.js'

export const actions = {
	default: async (event) => {
		const { auth } = await getCalendarAuth({ event })
		return auth.handlers.logout.default(event)
	}
}
