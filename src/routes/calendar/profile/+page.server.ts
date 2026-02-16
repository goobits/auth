import { buildEnv } from '../../api/calendar/_bridge.ts'
import { getCalendarProfile, listUpcomingEvents } from '$lib/server/calendar-social'

export async function load({ platform, locals }: { platform: App.Platform; locals: { user?: { id?: string | number } } }) {
	const rawUserId = locals.user?.id
	const userId = typeof rawUserId === 'string' ? rawUserId : typeof rawUserId === 'number' ? String(rawUserId) : ''
	if (!userId) {
		return {
			profile: { emergencyContact: '', dietaryRestrictions: '', chatHandle: '' },
			events: []
		}
	}

	const env = await buildEnv(platform)
	const [profile, events] = await Promise.all([
		getCalendarProfile(env.DB, userId),
		listUpcomingEvents(env.DB, userId, true)
	])

	return { profile, events }
}

