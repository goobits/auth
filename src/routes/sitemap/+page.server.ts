import { dev } from '$app/environment'
import { getRouteInventory } from '$lib/server/route-index'

export const prerender = true

function isTruthy(value: string | undefined) {
	if (!value) return false
	return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export async function load() {
	const showDevDiagnostics = dev && isTruthy(process.env.PUBLIC_SHOW_DEV_SITEMAP)
	const inventory = await getRouteInventory({ includeDevOnlyCategories: showDevDiagnostics })

	return {
		routes: inventory.routes,
		grouped: inventory.grouped,
		stats: inventory.stats,
		showDevDiagnostics
	}
}
