import { redirect } from '@sveltejs/kit'
import { getCalendarRedirect } from '$lib/auth/calendar.ts'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = ({ cookies }) => {
	const redirectTo = getCalendarRedirect(cookies) || '/calendar'
	throw redirect(302, redirectTo)
}
