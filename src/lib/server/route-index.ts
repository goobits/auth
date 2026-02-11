import fs from 'fs'
import path from 'path'
import { getJournalPosts } from '$lib/posts'

const ROUTES_DIR = 'src/routes'

export const DEV_ONLY_CATEGORIES = ['Admin Pages', 'API Routes', 'Utility Pages']

export type PageRoute = {
	path: string
	name: string
	type: 'page'
	hasServerLoad: boolean
	hasClientLoad: boolean
	hasLayout: boolean
	isDynamic: boolean
	hasAuth: boolean
	isNoIndex: boolean
	lastModified: string
	category: string
}

export type ApiRoute = {
	path: string
	name: string
	type: 'api'
	httpMethods: string[]
	isDynamic: boolean
	lastModified: string
	category: string
}

export type RouteEntry = PageRoute | ApiRoute

type RouteInventory = {
	routes: RouteEntry[]
	grouped: Record<string, RouteEntry[]>
	stats: {
		total: number
		pages: number
		api: number
		dynamic: number
		ssr: number
		protected: number
	}
}

type RouteInventoryOptions = {
	includeDevOnlyCategories?: boolean
}

type SitemapRoute = {
	path: string
	lastModified: string
}

function scanRoutes(dir: string, basePath = '') {
	const routes: RouteEntry[] = []
	const entries = fs.readdirSync(dir, { withFileTypes: true })

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)

		if (entry.isDirectory()) {
			if (entry.name.startsWith('_')) continue

			const newBase = entry.name.startsWith('(') ? basePath : `${basePath}/${entry.name}`
			routes.push(...scanRoutes(fullPath, newBase))
			continue
		}

		if (!entry.isFile()) continue

		const routePath = basePath || '/'
		if (entry.name === '+page.svelte') {
			const stat = fs.statSync(fullPath)
			const serverFile = path.join(dir, '+page.server.js')
			const serverTsFile = path.join(dir, '+page.server.ts')
			const clientFile = path.join(dir, '+page.js')
			const clientTsFile = path.join(dir, '+page.ts')
			const layoutFile = path.join(dir, '+layout.svelte')

			const hasServerLoad = fs.existsSync(serverFile) || fs.existsSync(serverTsFile)
			const hasClientLoad = fs.existsSync(clientFile) || fs.existsSync(clientTsFile)
			const hasLayout = fs.existsSync(layoutFile)

			const pageContent = fs.readFileSync(fullPath, 'utf-8')
			const isNoIndex = pageContent.includes('noindex') || pageContent.includes('robots')
			const isDynamic = routePath.includes('[')
			const hasAuth = routePath.includes('admin') || pageContent.includes('auth') || pageContent.includes('session')

			const pageRoute: PageRoute = {
				path: routePath,
				name: getRouteName(routePath),
				type: 'page',
				hasServerLoad,
				hasClientLoad,
				hasLayout,
				isDynamic,
				hasAuth,
				isNoIndex,
				lastModified: stat.mtime.toISOString(),
				category: categorizeRoute(routePath)
			}
			routes.push(pageRoute)
			continue
		}

		if (entry.name === '+server.js' || entry.name === '+server.ts') {
			const stat = fs.statSync(fullPath)
			const content = fs.readFileSync(fullPath, 'utf-8')
			const methods: string[] = []

			if (content.includes('export async function GET') || content.includes('export function GET')) methods.push('GET')
			if (content.includes('export async function POST') || content.includes('export function POST')) methods.push('POST')
			if (content.includes('export async function PUT') || content.includes('export function PUT')) methods.push('PUT')
			if (content.includes('export async function DELETE') || content.includes('export function DELETE')) methods.push('DELETE')
			if (content.includes('export async function PATCH') || content.includes('export function PATCH')) methods.push('PATCH')

			const apiRoute: ApiRoute = {
				path: routePath,
				name: getRouteName(routePath),
				type: 'api',
				httpMethods: methods,
				isDynamic: routePath.includes('['),
				lastModified: stat.mtime.toISOString(),
				category: 'API Routes'
			}
			routes.push(apiRoute)
		}
	}

	return routes
}

function getRouteName(routePath: string) {
	if (routePath === '/') return 'Home'

	const parts = routePath.split('/').filter(Boolean)
	const lastPart = parts[parts.length - 1]
	if (lastPart.startsWith('[') && lastPart.endsWith(']')) {
		const paramName = lastPart.slice(1, -1)
		return `${parts[parts.length - 2] || ''} (${paramName})`.trim()
	}

	return lastPart
		.split('-')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
}

function categorizeRoute(routePath: string) {
	if (routePath === '/') return 'Main Pages'
	if (routePath.startsWith('/admin')) return 'Admin Pages'
	if (routePath.startsWith('/api')) return 'API Routes'
	if (routePath.startsWith('/journal')) return 'Journal Pages'
	if (routePath === '/health' || routePath === '/sitemap') return 'Utility Pages'
	return 'Main Pages'
}

export async function getRouteInventory(options: RouteInventoryOptions = {}): Promise<RouteInventory> {
	const includeDevOnlyCategories = options.includeDevOnlyCategories ?? true

	const routes = scanRoutes(ROUTES_DIR)
	const posts = await getJournalPosts()

	const postRoutes: PageRoute[] = posts.map(post => {
		const fm = post.metadata?.fm
		const title = fm && typeof fm === 'object' && 'title' in fm ? String((fm as { title?: unknown }).title ?? '') : ''
		return {
			path: `/${post.urlPath}`,
			name: title || post.slug,
			type: 'page',
			hasServerLoad: true,
			hasClientLoad: false,
			hasLayout: false,
			isDynamic: true,
			hasAuth: false,
			isNoIndex: false,
			lastModified: post.date.toISOString(),
			category: 'Journal Posts'
		}
	})

	let allRoutes: RouteEntry[] = [...routes, ...postRoutes]
	if (!includeDevOnlyCategories) {
		allRoutes = allRoutes.filter(route => !DEV_ONLY_CATEGORIES.includes(route.category))
	}

	const pageRoutes = allRoutes.filter((route): route is PageRoute => route.type === 'page')
	const apiRoutes = allRoutes.filter((route): route is ApiRoute => route.type === 'api')
	const stats = {
		total: allRoutes.length,
		pages: pageRoutes.length,
		api: apiRoutes.length,
		dynamic: allRoutes.filter(route => route.isDynamic).length,
		ssr: pageRoutes.filter(route => route.hasServerLoad).length,
		protected: pageRoutes.filter(route => route.hasAuth).length
	}

	const grouped: Record<string, RouteEntry[]> = {}
	for (const route of allRoutes) {
		if (!grouped[route.category]) grouped[route.category] = []
		grouped[route.category].push(route)
	}

	for (const category of Object.keys(grouped)) {
		grouped[category].sort((a, b) => a.path.localeCompare(b.path))
	}

	return {
		routes: allRoutes,
		grouped,
		stats
	}
}

export async function getPublicSitemapRoutes() {
	const inventory = await getRouteInventory({ includeDevOnlyCategories: false })
	const publicPages = inventory.routes.filter((route): route is PageRoute => {
		if (route.type !== 'page') return false
		if (route.path.includes('[')) return false
		if (route.hasAuth) return false
		if (route.isNoIndex) return false
		return true
	})

	const deduped = new Map<string, SitemapRoute>()
	for (const route of publicPages) {
		deduped.set(route.path, { path: route.path, lastModified: route.lastModified })
	}

	return [...deduped.values()].sort((a, b) => a.path.localeCompare(b.path))
}
