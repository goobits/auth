import { dev } from '$app/environment'
import type { PageServerLoad } from './$types'

type PlatformEnv = {
	GOOGLE_CLIENT_ID?: string
	GOOGLE_CLIENT_SECRET?: string
	APPLE_CLIENT_ID?: string
	APPLE_TEAM_ID?: string
	APPLE_KEY_ID?: string
	APPLE_PRIVATE_KEY?: string
	[key: string]: string | undefined
}

function mergedEnv(platformEnv?: PlatformEnv) {
	return {
		...Object.fromEntries(
			Object.entries(process.env).filter(([, value]) => typeof value === 'string')
		),
		...(platformEnv ?? {})
	} as Record<string, string | undefined>
}

export const load: PageServerLoad = async ({ platform }) => {
	const env = mergedEnv((platform?.env as PlatformEnv | undefined))
	const providers = {
		google: !!(env['GOOGLE_CLIENT_ID'] && env['GOOGLE_CLIENT_SECRET']),
		apple: !!(env['APPLE_CLIENT_ID'] && env['APPLE_TEAM_ID'] && env['APPLE_KEY_ID'] && env['APPLE_PRIVATE_KEY'])
	}

	// In local development, keep at least Google button available when configured.
	return {
		providers,
		hasAnyProvider: providers.google || providers.apple,
		isDev: dev
	}
}
