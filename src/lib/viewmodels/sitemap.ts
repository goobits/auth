import type { RouteEntry } from '$lib/server/route-index'
import { localeSort, matchesQuery, normalizeQuery } from '$lib/utils/collections'

export type SitemapSort = 'path' | 'name' | 'modified'

export const baseSitemapTags = ['SSR', 'CSR', 'Dynamic', 'Layout'] as const
export const devSitemapTags = ['SSR', 'CSR', 'Dynamic', 'Auth', 'NoIndex', 'API', 'Layout'] as const

export function getSitemapAvailableTags(showDevDiagnostics: boolean) {
	return showDevDiagnostics ? [...devSitemapTags] : [...baseSitemapTags]
}

export function getRouteTags(route: RouteEntry) {
	const tags: string[] = []
	if (route.type === 'api') tags.push('API')
	if (route.type === 'page' && route.hasServerLoad) tags.push('SSR')
	if (route.type === 'page' && route.hasClientLoad) tags.push('CSR')
	if (route.isDynamic) tags.push('Dynamic')
	if (route.type === 'page' && route.hasAuth) tags.push('Auth')
	if (route.type === 'page' && route.isNoIndex) tags.push('NoIndex')
	if (route.type === 'page' && route.hasLayout) tags.push('Layout')
	return tags
}

function sortRoutes(routes: RouteEntry[], sortBy: SitemapSort) {
	return [...routes].sort((a, b) => {
		switch (sortBy) {
			case 'name':
				return localeSort(a.name, b.name)
			case 'modified':
				return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
			case 'path':
			default:
				return localeSort(a.path, b.path)
		}
	})
}

function matchesSitemapFilters(route: RouteEntry, query: string, selectedTags: string[]) {
	if (!matchesQuery(query, [route.path, route.name])) return false
	if (selectedTags.length === 0) return true
	const tags = getRouteTags(route)
	return selectedTags.every((tag) => tags.includes(tag))
}

export function getFilteredSitemapGroups(
	grouped: Record<string, RouteEntry[]>,
	searchQuery: string,
	selectedTags: string[],
	sortBy: SitemapSort
) {
	const query = normalizeQuery(searchQuery)
	const result: Record<string, RouteEntry[]> = {}

	for (const [category, routes] of Object.entries(grouped)) {
		const filtered = routes.filter((route) => matchesSitemapFilters(route, query, selectedTags))
		if (filtered.length > 0) {
			result[category] = sortRoutes(filtered, sortBy)
		}
	}

	return result
}

export function getFilteredSitemapCount(grouped: Record<string, RouteEntry[]>) {
	return Object.values(grouped).reduce((sum, routes) => sum + routes.length, 0)
}
