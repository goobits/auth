import { getCalendarAuth } from '$lib/auth/calendar.js'

export async function GET(event) {
	const { auth } = await getCalendarAuth({ event })
	return auth.handlers.callback(event)
}

export async function POST(event) {
	const { auth } = await getCalendarAuth({ event })
	return auth.handlers.callback(event)
}
