import fs from 'fs/promises'
import path from 'path'
import { redirect } from '@sveltejs/kit'
import { redirects } from '@src/redirects.js'
import { sequence } from '@sveltejs/kit/hooks'

const handleIndexHtml = async ({ event, resolve }) => {
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