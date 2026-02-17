import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../_bridge.ts'
import { buildPaymentLink, listEventsFeed } from '@miko/calendar'
import { getCalendarUserId, unauthorizedCalendar } from '../_auth.ts'
import { apiOk, apiError, logApiError } from '$lib/server/http/api'

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
