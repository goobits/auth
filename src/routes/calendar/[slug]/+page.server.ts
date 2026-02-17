import { error } from '@sveltejs/kit'
import { buildEnv } from '../../api/calendar/_bridge.ts'
import { buildPaymentLink, getCalendarProgramBySlug, listEventsFeed } from '@miko/calendar'

export async function load({
	platform,
	params,
	locals
}: {
	platform: App.Platform
	params: { slug: string }
	locals: { user?: { id?: string | number } }
}) {
	const env = await buildEnv(platform)
	const activity = await getCalendarProgramBySlug(env.DB, params.slug)
	if (!activity) {
		throw error(404, 'Program not found')
	}
	const rawUserId = locals.user?.id
	const userId = typeof rawUserId === 'string' ? rawUserId : typeof rawUserId === 'number' ? String(rawUserId) : ''
	const feed = userId ? await listEventsFeed(env.DB, userId, false) : { upcoming: [], recent: [] }
	const upcoming = feed.upcoming
		.filter((entry) => entry.activitySlug === activity.slug)
		.map((entry) => ({
			...entry,
			payUrl: buildPaymentLink({
				provider: entry.paymentProvider,
				handle: entry.paymentHandle,
				amountCents: entry.costCents,
				currency: entry.currency,
				note: entry.paymentNoteTemplate || entry.title
			})
		}))
	const recent = feed.recent.filter((entry) => entry.activitySlug === activity.slug)
	return { activity, upcoming, recent }
}
