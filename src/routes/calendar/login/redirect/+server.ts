import { redirect } from '@sveltejs/kit'
import { getCalendarRedirect } from '$lib/auth/calendar.ts'

export function GET({ cookies }: { cookies: any }) {
	const redirectTo = getCalendarRedirect(cookies) || '/calendar'
	throw redirect(302, redirectTo)
}
