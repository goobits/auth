export type CalendarProviderName = 'google' | 'apple'

export type CalendarProviderFlags = {
	google: boolean
	apple: boolean
}

export type CalendarAuthEnv = {
	GOOGLE_CLIENT_ID?: string
	GOOGLE_CLIENT_SECRET?: string
	APPLE_CLIENT_ID?: string
	APPLE_TEAM_ID?: string
	APPLE_KEY_ID?: string
	APPLE_PRIVATE_KEY?: string
	[key: string]: string | undefined
}

export function mergeAuthEnv(platformEnv?: CalendarAuthEnv) {
	return {
		...Object.fromEntries(
			Object.entries(process.env).filter(([, value]) => typeof value === 'string')
		),
		...(platformEnv ?? {})
	} as Record<string, string | undefined>
}

export function resolveCalendarProviders(env: Record<string, string | undefined>): CalendarProviderFlags {
	return {
		google: Boolean(env['GOOGLE_CLIENT_ID'] && env['GOOGLE_CLIENT_SECRET']),
		apple: Boolean(env['APPLE_CLIENT_ID'] && env['APPLE_TEAM_ID'] && env['APPLE_KEY_ID'] && env['APPLE_PRIVATE_KEY'])
	}
}

const providerErrors: Record<string, string> = {
	google_not_enabled: 'Google sign-in is not configured right now.',
	apple_not_enabled: 'Apple sign-in is not configured right now.'
}

export function getProviderErrorMessage(rawError: string) {
	return providerErrors[rawError] || rawError
}
