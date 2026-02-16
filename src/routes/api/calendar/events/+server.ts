import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../_bridge.ts'
import { listEventsFeed } from '@packages/calendar/src/services/social.ts'
import { buildPaymentLink } from '@packages/calendar/src/services/pay.ts'
import { getCalendarUserId, noStoreHeaders, unauthorizedCalendar } from '../_auth.ts'

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
		return json({ ok: true, ...withPayLinks }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('Calendar events list error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
