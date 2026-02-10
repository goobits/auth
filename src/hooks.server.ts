import { redirect } from '@sveltejs/kit'
import { redirects } from '@src/redirects.ts'
import { sequence } from '@sveltejs/kit/hooks'
import { createThemeHooks } from '@goobits/themes/server'
import { themeConfig } from '$lib/config/theme.ts'
import { getCalendarAuth } from '$lib/auth/calendar.ts'
import { getAdminAuth } from '$lib/auth/admin.ts'
import { dev } from '$app/environment'
import type { Handle } from '@sveltejs/kit'

/**
 * Processes redirects based on configured rules
 * @param {Object} options - Handler options
 * @param {Object} options.event - SvelteKit event object
 * @param {Function} options.resolve - SvelteKit resolve function
 * @returns {Promise<Response>} Passed to next handler if no redirect matches
 * @throws {Redirect} Redirects to target URL if a match is found
 */
async function handleRedirects({ event, resolve }: Parameters<Handle>[0]) {
	const pathname = event.url.pathname.toLowerCase()
	const matchingRedirect = redirects.find(redirect => {
		if (redirect.from.includes('(.*)')) {
			const pattern = new RegExp(redirect.from)
			return pattern.test(pathname)
		}
		if (redirect.from.endsWith('*')) {
			return pathname.startsWith(redirect.from.slice(0, -1))
		}
		return redirect.from === pathname
	})

	if (!matchingRedirect) {
		return resolve(event)
	}

	let redirectTo = matchingRedirect.to

	// Handle regex capture group replacements
	if (matchingRedirect.from.includes('(.*)')) {
		const pattern = new RegExp(matchingRedirect.from)
		redirectTo = pathname.replace(pattern, matchingRedirect.to)
	}

	throw redirect(matchingRedirect.status, redirectTo)
}

const themeHandle = createThemeHooks(themeConfig, {
	blockingScript: true
}).transform

async function handleAdminAuth({ event, resolve }: Parameters<Handle>[0]) {
	const pathname = event.url.pathname

	if (
		!pathname.startsWith('/admin') &&
		!pathname.startsWith('/api/admin') &&
		!pathname.startsWith('/api/calendar/admin')
	) {
		return resolve(event)
	}

	const { auth } = await getAdminAuth({ event })
	return auth.handle()({ event, resolve })
}

async function handleCalendarAuth({ event, resolve }: Parameters<Handle>[0]) {
	const pathname = event.url.pathname

	// Attach auth locals for calendar + auth routes
	if (!pathname.startsWith('/calendar') && !pathname.startsWith('/auth')) {
		return resolve(event)
	}

	const { auth } = await getCalendarAuth({ event })
	return auth.handle()({ event, resolve })
}

async function requireCalendarUser({ event, resolve }: Parameters<Handle>[0]) {
	const pathname = event.url.pathname

	if (!pathname.startsWith('/calendar')) {
		return resolve(event)
	}

	// Allow login page (with or without trailing slash) and API routes
	if (
		pathname === '/calendar/login' ||
		pathname === '/calendar/login/' ||
		pathname === '/calendar/login/redirect' ||
		pathname === '/calendar/login/redirect/' ||
		pathname.startsWith('/api/calendar')
	) {
		return resolve(event)
	}

	const locals = event.locals as { user?: unknown }
	if (!locals.user) {
		const redirectTo = encodeURIComponent(pathname)
		throw redirect(302, `/calendar/login?redirect=${redirectTo}`)
	}

	return resolve(event)
}

function setIfMissing(headers: Headers, key: string, value: string) {
	if (!headers.has(key)) headers.set(key, value)
}

const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event)

	const url = event.url
	const isHttps = url?.protocol === 'https:'

	const csp = [
		"default-src 'self'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		"img-src 'self' data: https:",
		"style-src 'self' 'unsafe-inline'",
		`script-src 'self'${dev ? " 'unsafe-inline' 'unsafe-eval'" : ''}`,
		"connect-src 'self' https:",
		"font-src 'self' data: https:"
	].join('; ')

	setIfMissing(response.headers, 'Content-Security-Policy', csp)
	setIfMissing(response.headers, 'Referrer-Policy', 'strict-origin-when-cross-origin')
	setIfMissing(response.headers, 'X-Content-Type-Options', 'nosniff')
	setIfMissing(response.headers, 'X-Frame-Options', 'DENY')
	setIfMissing(response.headers, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

	if (isHttps) {
		setIfMissing(response.headers, 'Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
	}

	return response
}

export const handle = sequence(
	themeHandle,
	handleRedirects,
	handleAdminAuth,
	handleCalendarAuth,
	requireCalendarUser,
	securityHeadersHandle
)
