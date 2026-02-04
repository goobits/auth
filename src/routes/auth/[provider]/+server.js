import { getCalendarAuth, setCalendarLoginContext } from '$lib/auth/calendar.js'

export async function GET(event) {
	const { auth, secureCookies } = await getCalendarAuth({ event })
	const invite = event.url.searchParams.get('invite') || null
	const redirectTo = event.url.searchParams.get('redirect') || null

	setCalendarLoginContext(event.cookies, {
		invite,
		redirectTo,
		secure: secureCookies
	})

	return auth.handlers.login(event)
}
