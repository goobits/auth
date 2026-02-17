import { buildEnv } from '../api/calendar/_bridge.ts'
import { loadCalendarMemberHomeData } from '@packages/calendar/src/index.ts'

export async function load({ platform, locals, url }: { platform: App.Platform; locals: { user?: { id?: string | number } }; url: URL }) {
	const env = await buildEnv(platform)
	const rawUserId = locals.user?.id
	const userId = typeof rawUserId === 'string' ? rawUserId : typeof rawUserId === 'number' ? String(rawUserId) : ''
	const onlyMine = url.searchParams.get('mine') === '1'
	return loadCalendarMemberHomeData(env.DB, { userId, onlyMine })
}
