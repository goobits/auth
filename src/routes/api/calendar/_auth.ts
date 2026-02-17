import type { RequestEvent } from '@sveltejs/kit'
import { apiError } from '$lib/server/http/api'
export { noStoreHeaders } from '$lib/server/http/api'

type CalendarLocals = {
	user?: {
		id?: string | number
		[key: string]: unknown
	}
}

export function getCalendarUserId(event: RequestEvent) {
	const locals = event.locals as CalendarLocals
	const id = locals.user?.id
	if (typeof id === 'string') return id
	if (typeof id === 'number') return String(id)
	return null
}

export function unauthorizedCalendar() {
	return apiError('Unauthorized', { status: 401 })
}
