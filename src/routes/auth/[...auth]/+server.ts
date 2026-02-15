import { getCalendarAuth, setCalendarLoginContext } from '$lib/auth/calendar.ts'
import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

const AUTH_RESERVED = new Set(['auth', 'signin', 'signout', 'callback', 'logout', 'magic-link', 'passkey', 'sessions'])

function resolveLegacySigninPath(pathname: string) {
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

function resolveRequestedProvider(pathname: string) {
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

function resolveCallbackProvider(pathname: string) {
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

export const GET: RequestHandler = async (event) => {
	const { auth, secureCookies } = await getCalendarAuth({ event })

	// Set invite/redirect cookies on signin routes (e.g. /auth/google)
	const invite = event.url.searchParams.get('invite') || null
	const redirectTo = event.url.searchParams.get('redirect') || null
	if (invite || redirectTo) {
		const context: { invite?: string; redirectTo?: string; secure: boolean } = { secure: secureCookies }
		if (invite) context.invite = invite
		if (redirectTo) context.redirectTo = redirectTo
		setCalendarLoginContext(event.cookies, {
			...context
		})
	}

	// Backward-compatible OAuth provider route:
	// /auth/signin/google -> /auth/google
	const providerPath = resolveLegacySigninPath(event.url.pathname)
	if (providerPath) {
		const query = event.url.search || ''
		throw redirect(302, `${providerPath}${query}`)
	}

	const requestedProvider = resolveRequestedProvider(event.url.pathname)
	if (requestedProvider) {
		const providers = auth?.providers ?? {}
		if (!(requestedProvider in providers)) {
			const params = new URLSearchParams(event.url.searchParams)
			params.set('error', `${requestedProvider}_not_enabled`)
			throw redirect(302, `/calendar/login?${params.toString()}`)
		}
	}

	const callbackProvider = resolveCallbackProvider(event.url.pathname)
	if (callbackProvider) {
		const callbackState = event.url.searchParams.get('state')
		const callbackCode = event.url.searchParams.get('code')
		const storedState = event.cookies.get(`${callbackProvider}_oauth_state`) || null
		const storedCodeVerifier = event.cookies.get(`${callbackProvider}_oauth_code_verifier`) || null

		const validCallbackParams = Boolean(
			callbackCode &&
			callbackState &&
			storedState &&
			storedCodeVerifier &&
			callbackState === storedState
		)
		if (!validCallbackParams) {
			const params = new URLSearchParams()
			params.set('error', 'oauth_state_invalid')
			throw redirect(302, `/calendar/login?${params.toString()}`)
		}
	}

	return auth.handlers.GET(event)
}

export const POST: RequestHandler = async (event) => {
	const { auth } = await getCalendarAuth({ event })
	return auth.handlers.POST(event)
}
