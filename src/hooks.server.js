import fs from 'fs/promises'
import path from 'path'
import { redirect } from '@sveltejs/kit'
import { redirects } from '@src/redirects.js'
import { sequence } from '@sveltejs/kit/hooks'

/**
 * Handles serving index.html files for directory paths
 * @param {Object} options - Handler options
 * @param {Object} options.event - SvelteKit event object
 * @param {Function} options.resolve - SvelteKit resolve function
 * @returns {Promise<Response>} Response object with HTML content or passed to next handler
 * @throws {Redirect} Redirects to path with trailing slash if missing
 */
async function handleIndexHtml({ event, resolve }) {
	const pathname = event.url.pathname
	const staticPath = path.join('static', pathname)
	const indexPath = path.join('static', pathname, 'index.html')

	const exists = await fs.access(indexPath).then(() => true).catch(() => false)
	if (!exists) {
		return resolve(event)
	}

	if (!pathname.endsWith('/')) {
		console.log('Redirecting to', `${ pathname }/`)
		throw redirect(301, `${ pathname }/`)
	}

	const html = await fs.readFile(indexPath, 'utf-8')
	return new Response(html, {
		headers: { 'Content-Type': 'text/html' }
	})
}

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

	// Handle external redirects immediately
	if (isExternalUrl(redirectTo)) {
		throw redirect(matchingRedirect.status, redirectTo)
	}

	// Check if internal redirect target is a directory
	const finalPath = path.join('static', redirectTo, 'index.html')
	const isDirectory = await fs.access(finalPath).then(() => true).catch(() => false)

	if (isDirectory && !redirectTo.endsWith('/')) {
		redirectTo = `${ redirectTo }/`
	}

	throw redirect(matchingRedirect.status, redirectTo)
}

/**
 * Combined request handler that processes redirects and serves index.html files
 */
export const handle = sequence(
	handleRedirects,
	handleIndexHtml
)

/**
 * Checks if a URL is external (starts with http:// or https://)
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL is external, false otherwise
 */
function isExternalUrl(url) {
	return url.startsWith('http://')
		|| url.startsWith('https://')
}