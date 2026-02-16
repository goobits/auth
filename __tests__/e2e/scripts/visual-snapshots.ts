import fs from 'fs/promises'
import path from 'path'
import { chromium } from 'playwright'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3610'
const OUT_DIR = process.env.E2E_SNAPSHOT_DIR || '.artifacts/visual'
const ROUTES = [
	'/',
	'/about',
	'/journal',
	'/labs',
	'/sitemap',
	'/contact',
	'/music',
	'/art',
	'/privacy',
	'/terms',
	'/cookies',
	'/calendar/login'
]
const THEMES = ['default', 'dark', 'magic']
const VIEWPORTS = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'mobile', width: 430, height: 932 }
]

function routeToFile(route) {
	if (route === '/') return 'home'
	return route.replaceAll('/', '_').replace(/^_/, '')
}

async function applyTheme(page, theme) {
	await page.evaluate((themeName) => {
		document.documentElement.setAttribute('data-theme', themeName)
		document.documentElement.classList.remove('theme-dark', 'theme-magic')
		if (themeName === 'dark') document.documentElement.classList.add('theme-dark')
		if (themeName === 'magic') document.documentElement.classList.add('theme-magic')
	}, theme)
}

export async function runVisualSnapshots() {
	await fs.mkdir(OUT_DIR, { recursive: true })
	const browser = await chromium.launch({ headless: true })
	const context = await browser.newContext()

	try {
		for (const viewport of VIEWPORTS) {
			await context.setExtraHTTPHeaders({})
			const page = await context.newPage({ viewport: { width: viewport.width, height: viewport.height } })
			for (const route of ROUTES) {
				for (const theme of THEMES) {
					const url = `${BASE_URL}${route}`
					const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
					if (!response || response.status() >= 500) {
						throw new Error(`Failed to load ${url} for theme ${theme} (${response?.status() ?? 'no response'})`)
					}
					await applyTheme(page, theme)
					await page.waitForTimeout(150)
					const file = `${routeToFile(route)}__${theme}__${viewport.name}.png`
					await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: true })
				}
			}
			await page.close()
		}
	} finally {
		await context.close()
		await browser.close()
	}

	console.log(`[visual-snapshots] Captured ${ROUTES.length * THEMES.length * VIEWPORTS.length} screenshots in ${OUT_DIR}`)
}
