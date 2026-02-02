import fs from 'fs'
import path from 'path'
import { dev } from '$app/environment'
import { getJournalPosts } from '$lib/posts'

export const prerender = true

const ROUTES_DIR = 'src/routes'

// Categories to hide in production
const DEV_ONLY_CATEGORIES = ['Admin Pages', 'API Routes', 'Utility Pages']

function scanRoutes(dir, basePath = '') {
	const routes = []
	const entries = fs.readdirSync(dir, { withFileTypes: true })

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)

		if (entry.isDirectory()) {
			// Skip private directories
			if (entry.name.startsWith('_')) continue

			const newBase = entry.name.startsWith('(')
				? basePath // Layout groups don't add to path
				: `${basePath}/${entry.name}`

			routes.push(...scanRoutes(fullPath, newBase))
		} else if (entry.isFile()) {
			const routePath = basePath || '/'

			// Only process route files
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

				// Check page content for special markers
				const pageContent = fs.readFileSync(fullPath, 'utf-8')
				const isNoIndex = pageContent.includes('noindex') || pageContent.includes('robots')

				// Determine if route has dynamic segments
				const isDynamic = routePath.includes('[')

				// Determine if route requires auth (check for auth patterns)
				const hasAuth = routePath.includes('admin') ||
					pageContent.includes('auth') ||
					pageContent.includes('session')

				routes.push({
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
				})
			} else if (entry.name === '+server.js' || entry.name === '+server.ts') {
				const stat = fs.statSync(fullPath)
				const content = fs.readFileSync(fullPath, 'utf-8')

				// Extract HTTP methods
				const methods = []
				if (content.includes('export async function GET') || content.includes('export function GET')) methods.push('GET')
				if (content.includes('export async function POST') || content.includes('export function POST')) methods.push('POST')
				if (content.includes('export async function PUT') || content.includes('export function PUT')) methods.push('PUT')
				if (content.includes('export async function DELETE') || content.includes('export function DELETE')) methods.push('DELETE')
				if (content.includes('export async function PATCH') || content.includes('export function PATCH')) methods.push('PATCH')

				routes.push({
					path: routePath,
					name: getRouteName(routePath),
					type: 'api',
					httpMethods: methods,
					isDynamic: routePath.includes('['),
					lastModified: stat.mtime.toISOString(),
					category: 'API Routes'
				})
			}
		}
	}

	return routes
}

function getRouteName(routePath) {
	if (routePath === '/') return 'Home'

	const parts = routePath.split('/').filter(Boolean)
	const lastPart = parts[parts.length - 1]

	// Handle dynamic segments
	if (lastPart.startsWith('[') && lastPart.endsWith(']')) {
		const paramName = lastPart.slice(1, -1)
		return `${parts[parts.length - 2] || ''} (${paramName})`.trim()
	}

	// Convert kebab-case to Title Case
	return lastPart
		.split('-')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
}

function categorizeRoute(routePath) {
	if (routePath === '/') return 'Main Pages'
	if (routePath.startsWith('/admin')) return 'Admin Pages'
	if (routePath.startsWith('/api')) return 'API Routes'
	if (routePath.startsWith('/journal')) return 'Journal Pages'
	if (routePath === '/health' || routePath === '/sitemap') return 'Utility Pages'

	return 'Main Pages'
}

export async function load() {
	// Scan file system for routes
	const routes = scanRoutes(ROUTES_DIR)

	// Get journal posts for dynamic content
	const posts = await getJournalPosts()

	// Add dynamic journal post routes
	const postRoutes = posts.map(p => ({
		path: `/${p.urlPath}`,
		name: p.metadata?.fm?.title || p.slug,
		type: 'page',
		hasServerLoad: true,
		hasClientLoad: false,
		isDynamic: true,
		hasAuth: false,
		isNoIndex: false,
		lastModified: p.date.toISOString(),
		category: 'Journal Posts'
	}))

	// Filter routes based on environment
	let allRoutes = [...routes, ...postRoutes]

	if (!dev) {
		// In production, hide sensitive routes
		allRoutes = allRoutes.filter(r => !DEV_ONLY_CATEGORIES.includes(r.category))
	}

	// Calculate stats
	const stats = {
		total: allRoutes.length,
		pages: allRoutes.filter(r => r.type === 'page').length,
		api: allRoutes.filter(r => r.type === 'api').length,
		dynamic: allRoutes.filter(r => r.isDynamic).length,
		ssr: allRoutes.filter(r => r.hasServerLoad).length,
		protected: allRoutes.filter(r => r.hasAuth).length
	}

	// Group by category
	const grouped = {}
	for (const route of allRoutes) {
		const cat = route.category
		if (!grouped[cat]) grouped[cat] = []
		grouped[cat].push(route)
	}

	// Sort routes within each category by path
	for (const cat of Object.keys(grouped)) {
		grouped[cat].sort((a, b) => a.path.localeCompare(b.path))
	}

	return {
		routes: allRoutes,
		grouped,
		stats,
		isDev: dev
	}
}
