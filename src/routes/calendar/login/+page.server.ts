import { dev } from '$app/environment'
import { mergeAuthEnv, resolveCalendarProviders } from '@miko/calendar-ui/auth/ui/providers'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ platform }) => {
	const env = mergeAuthEnv(platform?.env as Record<string, string | undefined> | undefined)
	const providers = resolveCalendarProviders(env)

	// In local development, keep at least Google button available when configured.
	return {
		providers,
		hasAnyProvider: providers.google || providers.apple,
		isDev: dev
	}
}
