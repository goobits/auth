import { CALENDAR_ACTIVITY_LIST, type CalendarActivityConfig } from '@packages/calendar/src/social/activities.ts'
import type { CalendarProviderName } from '$lib/auth/ui/providers'

export function resolveCalendarLoginTargetActivity(path: string): CalendarActivityConfig | null {
	const pathname = path.split('?')[0]?.replace(/\/+$/, '') || ''
	return CALENDAR_ACTIVITY_LIST.find((item) => item.href === pathname) ?? null
}

export function resolveFirstAvailableProvider(
	providers: Record<CalendarProviderName, boolean>
): CalendarProviderName | null {
	if (providers.google) return 'google'
	if (providers.apple) return 'apple'
	return null
}
