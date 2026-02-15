import fs from 'fs'
import path from 'path'

const staticDir = path.join(process.cwd(), 'static')

export function hasStaticFile(urlPath: string) {
	const cleanPath = urlPath.split('?')[0]?.split('#')[0] ?? urlPath
	const normalizedPath = cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath
	const candidates: string[] = []

	if (normalizedPath.endsWith('/')) {
		candidates.push(`${normalizedPath}index.html`)
	}
	candidates.push(normalizedPath)
	if (!normalizedPath.endsWith('.html')) {
		candidates.push(`${normalizedPath}.html`)
	}

	return candidates.some((candidate) => fs.existsSync(path.join(staticDir, candidate)))
}

export function handlePrerenderHttpError(pathname: string, message: string) {
	if (pathname.startsWith('/labs/') && hasStaticFile(pathname)) {
		return
	}
	// Don't fail the build on missing non-HTML assets referenced by legacy content.
	// These should be fixed over time, but blocking deploys on old broken image URLs isn't useful.
	if (/\.(png|jpg|jpeg|gif|webp|avif|svg)$/i.test(pathname)) {
		return
	}
	if (pathname.includes('[') && pathname.includes(']')) {
		return
	}
	throw new Error(message)
}
