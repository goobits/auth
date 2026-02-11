import type { RequestHandler } from './$types'
import { getPublicSitemapRoutes } from '$lib/server/route-index'
import { escapeXml, formatSitemapLastMod, resolveSiteOrigin, toAbsoluteUrl } from '$lib/server/seo'

export const prerender = true

function getBaseUrl(platformEnv: Record<string, string | undefined> | undefined) {
	return platformEnv?.PUBLIC_BASE_URL || platformEnv?.BASE_URL || process.env.PUBLIC_BASE_URL || process.env.BASE_URL
}

function getPlatformEnv(platform: unknown): Record<string, string | undefined> | undefined {
	return (platform as { env?: Record<string, string | undefined> } | undefined)?.env
}

export const GET: RequestHandler = async ({ platform, url }) => {
	const baseUrl = getBaseUrl(getPlatformEnv(platform))
	const origin = resolveSiteOrigin({ baseUrl, requestUrl: url })
	const routes = await getPublicSitemapRoutes()

	const urlEntries = routes.map(route => {
		const loc = escapeXml(toAbsoluteUrl(origin, route.path))
		const lastMod = escapeXml(formatSitemapLastMod(route.lastModified))
		return `<url><loc>${loc}</loc><lastmod>${lastMod}</lastmod></url>`
	}).join('')

	const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlEntries}</urlset>`

	return new Response(xml, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=300, s-maxage=300'
		}
	})
}
