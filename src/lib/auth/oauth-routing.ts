import type { Cookies } from '@sveltejs/kit'

const AUTH_RESERVED = new Set(['auth', 'signout', 'logout', 'magic-link', 'passkey', 'sessions'])

export function resolveRequestedProvider(pathname: string) {
	const parts = pathname.split('/').filter(Boolean)
	if (parts[0] !== 'auth') return null
	if (parts.length === 2) {
		const provider = parts[1]
		if (!provider || AUTH_RESERVED.has(provider)) return null
		return provider
	}
	return null
}

export function resolveCallbackProvider(pathname: string) {
	const parts = pathname.split('/').filter(Boolean)
	if (parts[0] !== 'auth') return null
	if (parts.length === 3 && parts[2] === 'callback') {
		const provider = parts[1]
		if (!provider || AUTH_RESERVED.has(provider)) return null
		return provider
	}
	return null
}

export function hasValidOAuthCallbackParams({
	url,
	cookies,
	provider
}: {
	url: URL
	cookies: Pick<Cookies, 'get'>
	provider: string
}) {
	const callbackState = url.searchParams.get('state')
	const callbackCode = url.searchParams.get('code')
	const storedState = cookies.get(`${provider}_oauth_state`) || null
	const storedCodeVerifier = cookies.get(`${provider}_oauth_code_verifier`) || null

	return Boolean(
		callbackCode &&
		callbackState &&
		storedState &&
		storedCodeVerifier &&
		callbackState === storedState
	)
}

export function isStatusError(value: unknown): value is { status: number } {
	return typeof value === 'object' &&
		value !== null &&
		'status' in value &&
		typeof (value as { status?: unknown }).status === 'number'
}

export function shouldWrapAsOauthFailure(error: unknown) {
	if (!isStatusError(error)) return true
	return error.status >= 500
}

export function buildCalendarLoginErrorPath(errorCode: string) {
	const params = new URLSearchParams()
	params.set('error', errorCode)
	return `/calendar/login?${params.toString()}`
}

export function getRedirectLocationFromError(error: unknown) {
	if (
		typeof error === 'object' &&
		error &&
		'location' in error &&
		typeof (error as { location?: unknown }).location === 'string'
	) {
		return (error as { location: string }).location
	}
	return ''
}
