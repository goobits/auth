import { getCalendarAuth, setCalendarLoginContext } from '$lib/auth/calendar.ts'
import {
	buildCalendarLoginErrorPath,
	getRedirectLocationFromError,
	hasValidOAuthCallbackParams,
	isStatusError,
	resolveCallbackProvider,
	resolveLegacySigninPath,
	resolveRequestedProvider,
	shouldWrapAsOauthFailure
} from '$lib/auth/oauth-routing'
import { redirect } from '@sveltejs/kit'
import { dev } from '$app/environment'
import type { RequestHandler } from './$types'

function logProviderRedirectDiagnostics({
	provider,
	location
}: {
	provider: string
	location: string
}) {
	if (!dev) return
	if (!location.startsWith('https://accounts.google.com/o/oauth2/v2/auth')) return

	const authUrl = new URL(location)
	const redirectUri = authUrl.searchParams.get('redirect_uri') || ''
	const clientId = authUrl.searchParams.get('client_id') || ''
	console.info('[auth oauth debug] provider redirect', {
		provider,
		clientId,
		redirectUri
	})
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
			throw redirect(302, buildCalendarLoginErrorPath(`${requestedProvider}_not_enabled`))
		}
	}

	const callbackProvider = resolveCallbackProvider(event.url.pathname)
	if (callbackProvider) {
		if (!hasValidOAuthCallbackParams({
			url: event.url,
			cookies: event.cookies,
			provider: callbackProvider
		})) {
			throw redirect(302, buildCalendarLoginErrorPath('oauth_state_invalid'))
		}
	}

	try {
		const response = await auth.handlers.GET(event)
		if (callbackProvider && response.status >= 500) {
			throw redirect(302, buildCalendarLoginErrorPath('oauth_failed'))
		}
		if (requestedProvider) {
			logProviderRedirectDiagnostics({
				provider: requestedProvider,
				location: response.headers.get('location') || ''
			})
		}
		return response
	} catch (error) {
		if (requestedProvider && isStatusError(error) && error.status >= 300 && error.status < 400) {
			logProviderRedirectDiagnostics({
				provider: requestedProvider,
				location: getRedirectLocationFromError(error)
			})
		}

		if (callbackProvider && shouldWrapAsOauthFailure(error)) {
			console.error('[auth oauth callback] unexpected failure', error)
			throw redirect(302, buildCalendarLoginErrorPath('oauth_failed'))
		}
		throw error
	}
}

export const POST: RequestHandler = async (event) => {
	const { auth } = await getCalendarAuth({ event })
	return auth.handlers.POST(event)
}
