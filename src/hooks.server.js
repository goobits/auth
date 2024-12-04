import fs from 'fs/promises'
import path from 'path'
import { redirect } from '@sveltejs/kit'
import { redirects } from '@src/redirects.js'
import { sequence } from '@sveltejs/kit/hooks'

const isExternalUrl = (url) => {
	return url.startsWith('http://') || url.startsWith('https://')
}

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

	if (matchingRedirect) {
		let redirectTo = matchingRedirect.to

		if (matchingRedirect.from.includes('(.*)')) {
			const pattern = new RegExp(matchingRedirect.from)
			redirectTo = pathname.replace(pattern, matchingRedirect.to)
		}

		// For external URLs, redirect immediately
		if (isExternalUrl(redirectTo)) {
			throw redirect(matchingRedirect.status, redirectTo)
		}

		// For internal URLs, check if it's a directory and add trailing slash if needed
		const finalPath = path.join('static', redirectTo, 'index.html')
		const isDirectory = await fs.access(finalPath).then(() => true).catch(() => false)

		if (isDirectory && !redirectTo.endsWith('/')) {
			redirectTo = `${ redirectTo }/`
		}

		throw redirect(matchingRedirect.status, redirectTo)
	}
	return resolve(event)
}

export const handle = sequence(
	handleIndexHtml,
	handleRedirects
)