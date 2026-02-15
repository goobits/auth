import type { Cookies } from '@sveltejs/kit'

const AUTH_RESERVED = new Set(['auth', 'signin', 'signout', 'callback', 'logout', 'magic-link', 'passkey', 'sessions'])

export function resolveLegacySigninPath(pathname: string) {
	const parts = pathname.split('/').filter(Boolean)
	if (parts.length < 3 || parts.length > 4) return null
	if (parts[0] !== 'auth') return null
	if (parts[1] !== 'signin') return null
	const provider = parts[2]
	if (!provider || provider === 'signout' || provider === 'callback') return null
	if (parts.length === 3) return `/auth/${provider}`
	if (parts.length === 4 && parts[3] === 'callback') return `/auth/${provider}/callback`
	return null
}

export function resolveRequestedProvider(pathname: string) {
	const parts = pathname.split('/').filter(Boolean)
	if (parts[0] !== 'auth') return null
	if (parts.length === 2) {
		const provider = parts[1]
		if (!provider || AUTH_RESERVED.has(provider)) return null
		return provider
	}
	if (parts.length === 3 && parts[1] === 'signin') {
		const provider = parts[2]
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
	if (parts.length === 3 && parts[1] === 'callback') {
		const provider = parts[2]
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
