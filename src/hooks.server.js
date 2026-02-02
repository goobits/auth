import { redirect } from '@sveltejs/kit'
import { redirects } from '@src/redirects.js'
import { sequence } from '@sveltejs/kit/hooks'
import { createThemeHooks } from '@goobits/themes/server'
import { themeConfig } from '$lib/config/theme.js'

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

export const handle = sequence(
	themeHandle,
	handleRedirects
)
