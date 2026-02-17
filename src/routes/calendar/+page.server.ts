import { buildEnv } from '@miko/calendar-kit'
import { loadCalendarMemberHomeData } from '@miko/calendar'

export async function load({ platform, locals, url }: { platform: App.Platform; locals: { user?: { id?: string | number } }; url: URL }) {
	const env = await buildEnv(platform)
	const rawUserId = locals.user?.id
	const userId = typeof rawUserId === 'string' ? rawUserId : typeof rawUserId === 'number' ? String(rawUserId) : ''
	const onlyMine = url.searchParams.get('mine') === '1'
	return loadCalendarMemberHomeData(env.DB, { userId, onlyMine })
}
