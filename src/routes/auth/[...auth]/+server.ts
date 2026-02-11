import { getCalendarAuth, setCalendarLoginContext } from '$lib/auth/calendar.ts'
import { redirect } from '@sveltejs/kit'

function resolveLegacyProviderPath(pathname: string) {
	const parts = pathname.split('/').filter(Boolean)
	if (parts.length !== 2) return null
	if (parts[0] !== 'auth') return null
	const provider = parts[1]
	if (!provider || provider === 'signin' || provider === 'signout' || provider === 'callback') return null
	return `/auth/signin/${provider}`
}

export async function GET(event: any) {
	const { auth, secureCookies } = await getCalendarAuth({ event })

	// Set invite/redirect cookies on signin routes (e.g. /auth/google)
	const invite = event.url.searchParams.get('invite') || null
	const redirectTo = event.url.searchParams.get('redirect') || null
	if (invite || redirectTo) {
		setCalendarLoginContext(event.cookies, {
			invite,
			redirectTo,
			secure: secureCookies
		})
	}

	// Backward-compatible OAuth provider route:
	// /auth/google -> /auth/signin/google
	const signinPath = resolveLegacyProviderPath(event.url.pathname)
	if (signinPath) {
		const query = event.url.search || ''
		throw redirect(302, `${signinPath}${query}`)
	}

	return auth.handlers.GET(event)
}

export async function POST(event: any) {
	const { auth } = await getCalendarAuth({ event })
	return auth.handlers.POST(event)
}
