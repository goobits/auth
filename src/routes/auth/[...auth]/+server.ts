import { getCalendarAuth, setCalendarLoginContext } from '$lib/auth/calendar.ts'

export async function GET(event: any) {
	const { auth, secureCookies } = await getCalendarAuth({ event })

	// Set invite/redirect cookies on signin routes (e.g. /auth/google)
	const invite = event.url.searchParams.get('invite') || null
	const redirectTo = event.url.searchParams.get('redirect') || null
	if (invite || redirectTo) {
		setCalendarLoginContext(event.cookies, {
			invite,
			redirectTo,
			secure: secureCookies
		})
	}

	return auth.handlers.GET(event)
}

export async function POST(event: any) {
	const { auth } = await getCalendarAuth({ event })
	return auth.handlers.POST(event)
}
