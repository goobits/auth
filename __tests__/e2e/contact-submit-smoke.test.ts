import { test } from 'vitest'
import { chromium } from 'playwright'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3610'

test('contact submit smoke', async () => {
	const browser = await chromium.launch({ headless: true })
	const context = await browser.newContext()
	const page = await context.newPage()
	const errors: string[] = []

	try {
		page.on('pageerror', (err) => {
			errors.push(`pageerror: ${String(err)}`)
		})
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(`console.error: ${msg.text()}`)
			}
		})

		await page.goto(`${BASE_URL}/contact`, { waitUntil: 'networkidle', timeout: 30_000 })

		await page.fill('input[name="name"]', 'E2E Contact User')
		await page.fill('input[name="email"]', `e2e-contact-${Date.now()}@example.com`)
		await page.fill('textarea[name="message"]', 'Hello from Playwright Vitest smoke test.')

		try {
			await Promise.all([
				page.waitForURL(/\/contact\/thank-you\/?$/, { timeout: 30_000 }),
				page.click('button[type="submit"]')
			])
		} catch (err) {
			throw new Error(
				`contact submit did not navigate (url=${page.url()}): ${String(err)}\n` +
				(errors.length ? `errors:\n- ${errors.join('\n- ')}\n` : 'errors: none\n')
			)
		}
	} finally {
		await context.close()
		await browser.close()
	}
}, 120_000)
