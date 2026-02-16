import { CALENDAR_ACTIVITY_LIST, type CalendarActivityConfig } from '$lib/booking/activities'

export type CalendarProgramSlug = CalendarActivityConfig['slug']

const KNOWN_PROGRAM_SLUGS = new Set<CalendarProgramSlug>(CALENDAR_ACTIVITY_LIST.map((activity) => activity.slug))

export function isKnownProgramSlug(value: string): value is CalendarProgramSlug {
	return KNOWN_PROGRAM_SLUGS.has(value as CalendarProgramSlug)
}

export function isValidProgramSlug(slug: string) {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}
