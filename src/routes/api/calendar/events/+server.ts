import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '@miko/calendar-kit'
import { buildPaymentLink, listEventsFeed } from '@miko/calendar'
import { apiError, apiOk, getCalendarUserId, logApiError, unauthorizedCalendar } from '@miko/calendar-kit'

export async function GET(event: RequestEvent) {
	try {
		const userId = getCalendarUserId(event)
		if (!userId) return unauthorizedCalendar()

		const env = await buildEnv(event.platform)
		const onlyMine = event.url.searchParams.get('mine') === '1'
		const feed = await listEventsFeed(env.DB, userId, onlyMine)
		const withPayLinks = {
			upcoming: feed.upcoming.map((entry) => ({
				...entry,
				payUrl: buildPaymentLink({
					provider: entry.paymentProvider,
					handle: entry.paymentHandle,
					amountCents: entry.costCents,
					currency: entry.currency,
					note: entry.paymentNoteTemplate || entry.title
				})
			})),
			recent: feed.recent
		}
		return apiOk(withPayLinks)
	} catch (err) {
		logApiError('calendar.events.list', err)
		return apiError('Internal server error')
	}
}
