import { buildEnv } from '../api/calendar/_bridge.ts'
import { getEnabledCalendarPrograms } from '$lib/server/calendar-programs'
import { listEventsFeed } from '$lib/server/calendar-social'
import { buildPaymentLink } from '$lib/server/calendar-pay'

export async function load({ platform, locals, url }: { platform: App.Platform; locals: { user?: { id?: string | number } }; url: URL }) {
	const env = await buildEnv(platform)
	const activities = await getEnabledCalendarPrograms(env.DB)
	const rawUserId = locals.user?.id
	const userId = typeof rawUserId === 'string' ? rawUserId : typeof rawUserId === 'number' ? String(rawUserId) : ''
	const onlyMine = url.searchParams.get('mine') === '1'
	const feed = userId ? await listEventsFeed(env.DB, userId, onlyMine) : { upcoming: [], recent: [] }
	const upcoming = feed.upcoming.map((entry) => ({
		...entry,
		payUrl: buildPaymentLink({
			provider: entry.paymentProvider,
			handle: entry.paymentHandle,
			amountCents: entry.costCents,
			currency: entry.currency,
			note: entry.paymentNoteTemplate || entry.title
		})
	}))
	return { activities, upcoming, recent: feed.recent, onlyMine }
}
