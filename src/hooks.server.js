import fs from 'fs/promises'
import path from 'path'
import { redirect } from '@sveltejs/kit'
import { redirects } from '@src/redirects.js'
import { sequence } from '@sveltejs/kit/hooks'

const handleIndexHtml = async ({ event, resolve }) => {
	// Only add trailing slash for static directory paths that exist
	const pathname = event.url.pathname
	const staticPath = path.join('static', pathname)

	try {
		const stats = await fs.stat(staticPath)
		if (stats.isDirectory() && !pathname.endsWith('/')) {
			throw redirect(301, `${ pathname }/`)
		}
	} catch {
	} // Ignore stat errors

	// Try serving index.html
	try {
		const indexPath = path.join('static', pathname, 'index.html')
		const html = await fs.readFile(indexPath, 'utf-8')
		return new Response(html, {
			headers: { 'Content-Type': 'text/html' }
		})
	} catch {
		return resolve(event)
	}
}

const handleRedirects = async ({ event, resolve }) => {
	const pathname = event.url.pathname
	const matchingRedirect = redirects.find(redirect => {
		if (redirect.from.endsWith('*')) {
			return pathname.startsWith(redirect.from.slice(0, -1))
		}
		return redirect.from === pathname
	})

	if (matchingRedirect) {
		throw redirect(matchingRedirect.status, matchingRedirect.to)
	}
	return resolve(event)
}

export const handle = sequence(handleIndexHtml, handleRedirects)