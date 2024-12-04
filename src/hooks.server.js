import fs from 'fs/promises'
import path from 'path'
import { redirect } from '@sveltejs/kit'
import { redirects } from '@src/redirects.js'
import { sequence } from '@sveltejs/kit/hooks'

const handleIndexHtml = async ({ event, resolve }) => {
	const pathname = event.url.pathname
	if (!pathname.endsWith('/') && pathname !== '/') {
		const staticPath = path.join('static', pathname)
		const indexExists = await fs.access(path.join(staticPath, 'index.html'))
			.then(() => true)
			.catch(() => false)

		if (indexExists) {
			throw redirect(301, `${ pathname }/`)
		}
	}

	return resolve(event)
}

const handleRedirects = async ({ event, resolve }) => {
	const pathname = event.url.pathname.toLowerCase()

	const matchingRedirect = redirects.find(redirect => {
		if (redirect.from.includes('(.*)')) {
			// Handle regex capture groups
			const pattern = new RegExp(`^${redirect.from}$`)
			return pattern.test(pathname)
		}
		if (redirect.from.endsWith('*')) {
			// Handle wildcard matches more efficiently
			const prefix = redirect.from.slice(0, -1)
			return pathname.startsWith(prefix)
		}
		return redirect.from === pathname
	})

	if (matchingRedirect) {
		let redirectTo = matchingRedirect.to

		if (matchingRedirect.from.includes('(.*)')) {
			// Handle capture group replacement
			const pattern = new RegExp(`^${matchingRedirect.from}$`)
			redirectTo = pathname.replace(pattern, redirectTo)
		}

		// Check if destination is a folder with index.html
		const destPath = path.join('static', redirectTo)
		const hasIndex = await fs.access(path.join(destPath, 'index.html'))
			.then(() => true)
			.catch(() => false)

		// Add trailing slash if it's a folder and doesn't have one
		if (hasIndex && !redirectTo.endsWith('/')) {
			redirectTo = `${ redirectTo }/`
		}

		throw redirect(matchingRedirect.status, redirectTo)
	}

	return resolve(event)
}

const handle = sequence(
	handleIndexHtml,
	handleRedirects
)

export { handle }