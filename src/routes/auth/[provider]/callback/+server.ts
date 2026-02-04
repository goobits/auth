import { getCalendarAuth } from '$lib/auth/calendar.ts'

export async function GET(event: any) {
	const { auth } = await getCalendarAuth({ event })
	return auth.handlers.callback(event)
}

export async function POST(event: any) {
	const { auth } = await getCalendarAuth({ event })
	return auth.handlers.callback(event)
}
