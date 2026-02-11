import type { RequestHandler } from './$types'
import { resolveSiteOrigin } from '$lib/server/seo'

export const prerender = true

function getBaseUrl(platformEnv: Record<string, string | undefined> | undefined) {
	return platformEnv?.PUBLIC_BASE_URL || platformEnv?.BASE_URL || process.env.PUBLIC_BASE_URL || process.env.BASE_URL
}

function getPlatformEnv(platform: unknown): Record<string, string | undefined> | undefined {
	return (platform as { env?: Record<string, string | undefined> } | undefined)?.env
}

export const GET: RequestHandler = ({ platform, url }) => {
	const baseUrl = getBaseUrl(getPlatformEnv(platform))
	const origin = resolveSiteOrigin({ baseUrl, requestUrl: url })

	const robots = [
		'User-agent: *',
		'Allow: /',
		'Disallow: /admin',
		'Disallow: /api',
		'Disallow: /health',
		`Sitemap: ${origin}/sitemap.xml`
	].join('\n')

	return new Response(robots, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=300, s-maxage=300'
		}
	})
}
