import { CALENDAR_ACTIVITY_LIST, type CalendarActivityConfig } from '$lib/booking/activities'

export type CalendarProgramSlug = CalendarActivityConfig['slug']

export const PROGRAM_SETTING_PREFIX = 'programEnabled:'

const KNOWN_PROGRAM_SLUGS = new Set<CalendarProgramSlug>(CALENDAR_ACTIVITY_LIST.map((activity) => activity.slug))

const ACTIVITY_NAME_TO_SLUG = new Map(
	CALENDAR_ACTIVITY_LIST.map((activity) => [activity.activityName, activity.slug] as const)
)

export function isKnownProgramSlug(value: string): value is CalendarProgramSlug {
	return KNOWN_PROGRAM_SLUGS.has(value as CalendarProgramSlug)
}

export function programSettingKey(slug: CalendarProgramSlug) {
	return `${PROGRAM_SETTING_PREFIX}${slug}`
}

export function parseProgramEnabledValue(value: string | null | undefined) {
	return value !== '0'
}

export function getProgramSlugFromActivityName(activityName: string) {
	return ACTIVITY_NAME_TO_SLUG.get(activityName) ?? null
}

