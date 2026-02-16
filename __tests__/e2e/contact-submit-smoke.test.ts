import { test } from 'vitest'
import { chromium } from 'playwright'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3610'

test('contact submit smoke', async () => {
	const browser = await chromium.launch({ headless: true })
	const context = await browser.newContext()
	const page = await context.newPage()

	try {
		await page.goto(`${BASE_URL}/contact`, { waitUntil: 'networkidle', timeout: 30_000 })

		await page.fill('input[name="name"]', 'E2E Contact User')
		await page.fill('input[name="email"]', `e2e-contact-${Date.now()}@example.com`)
		await page.fill('textarea[name="message"]', 'Hello from Playwright Vitest smoke test.')

		await Promise.all([
			page.waitForURL(/\/contact\/thank-you\/?$/, { timeout: 30_000 }),
			page.click('button[type="submit"]')
		])
	} finally {
		await context.close()
		await browser.close()
	}
}, 120_000)

