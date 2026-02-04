import { getCalendarAuth } from '$lib/auth/calendar.ts'

export async function GET(event: any) {
	const { auth } = await getCalendarAuth({ event })
	return auth.routes.sessions().GET(event)
}

export async function POST(event: any) {
	const { auth } = await getCalendarAuth({ event })
	return auth.routes.sessions().POST(event)
}
