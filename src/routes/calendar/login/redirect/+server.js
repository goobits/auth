import { redirect } from '@sveltejs/kit'
import { getCalendarRedirect } from '$lib/auth/calendar.js'

export function GET({ cookies }) {
	const redirectTo = getCalendarRedirect(cookies) || '/calendar'
	throw redirect(302, redirectTo)
}
