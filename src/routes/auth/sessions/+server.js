import { getCalendarAuth } from '$lib/auth/calendar.js'

export async function GET(event) {
	const { auth } = await getCalendarAuth({ event })
	return auth.routes.sessions().GET(event)
}

export async function POST(event) {
	const { auth } = await getCalendarAuth({ event })
	return auth.routes.sessions().POST(event)
}
