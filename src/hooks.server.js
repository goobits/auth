import { redirect } from '@sveltejs/kit'
import { redirects } from '@src/redirects.js'
import { sequence } from '@sveltejs/kit/hooks'
import { createThemeHooks } from '@goobits/themes/server'
import { themeConfig } from '$lib/config/theme.js'
import { dev } from '$app/environment'
import { validateSession, parseSessionCookie } from '@packages/calendar/src/rainbow/session.js'

/**
 * Processes redirects based on configured rules
 * @param {Object} options - Handler options
 * @param {Object} options.event - SvelteKit event object
 * @param {Function} options.resolve - SvelteKit resolve function
 * @returns {Promise<Response>} Passed to next handler if no redirect matches
 * @throws {Redirect} Redirects to target URL if a match is found
 */
async function handleRedirects({ event, resolve }) {
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

let cachedDevDb = null

async function getDb(platform) {
	if (platform?.env?.DB) {
		return platform.env.DB
	}
	if (dev) {
		if (!cachedDevDb) {
			const { createSqliteDb } = await import('$lib/dev/sqliteDb.js')
			cachedDevDb = createSqliteDb()
		}
		return cachedDevDb
	}
	return null
}

async function handleRainbowAuth({ event, resolve }) {
	const pathname = event.url.pathname

	// Only protect /rainbow/* routes (except login page and API routes)
	if (!pathname.startsWith('/rainbow')) {
		return resolve(event)
	}

	// Allow login page (with or without trailing slash) and API routes
	if (pathname === '/rainbow/login' || pathname === '/rainbow/login/' || pathname.startsWith('/api/rainbow')) {
		return resolve(event)
	}

	const cookieHeader = event.request.headers.get('Cookie')
	const sessionId = parseSessionCookie(cookieHeader)

	if (!sessionId) {
		const redirectTo = encodeURIComponent(pathname)
		throw redirect(302, `/rainbow/login?redirect=${redirectTo}`)
	}

	const db = await getDb(event.platform)
	if (!db) {
		throw redirect(302, '/rainbow/login?error=db_unavailable')
	}

	const user = await validateSession({ db, sessionId })

	if (!user) {
		const redirectTo = encodeURIComponent(pathname)
		throw redirect(302, `/rainbow/login?redirect=${redirectTo}`)
	}

	event.locals.rainbowUser = user
	return resolve(event)
}

export const handle = sequence(
	themeHandle,
	handleRedirects,
	handleRainbowAuth
)
