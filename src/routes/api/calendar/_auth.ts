import { json, type RequestEvent } from '@sveltejs/kit'

export const noStoreHeaders = {
	'Cache-Control': 'no-store, max-age=0'
}

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
	return json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401, headers: noStoreHeaders })
}

