import { execSync } from 'node:child_process'
import { chromium } from 'playwright'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3610'

function getAdminPasscode() {
	if (process.env.ADMIN_PASSCODE) return process.env.ADMIN_PASSCODE
	try {
		return execSync('pnpm exec dotenvx get ADMIN_PASSCODE -f config/env/.env', {
			stdio: ['ignore', 'pipe', 'ignore']
		})
			.toString('utf8')
			.trim()
	} catch {
		return ''
	}
}

function toLocalDateTimeInputValue(date: Date) {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const hours = String(date.getHours()).padStart(2, '0')
	const minutes = String(date.getMinutes()).padStart(2, '0')
	return `${year}-${month}-${day}T${hours}:${minutes}`
}

export async function runCalendarEventsFlow() {
	const passcode = getAdminPasscode()
	if (!passcode) throw new Error('ADMIN_PASSCODE not available')

	const browser = await chromium.launch({ headless: true })
	const context = await browser.newContext()
	const page = await context.newPage()

	try {
		await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 })

		if ((await page.locator('.admin-login').count()) > 0) {
			await page.fill('input[name="password"]', passcode)
			await page.click('button[type="submit"]')
		}

		await page.goto(`${BASE_URL}/admin/events`, { waitUntil: 'domcontentloaded', timeout: 30000 })
		await page.locator('.admin-page__title').first().waitFor({ timeout: 30000 })

		const title = `E2E Calendar Event ${Date.now()}`
		const startDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
		startDate.setMinutes(0, 0, 0)
		startDate.setHours(18)
		const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)

		await page.fill('#event-draft-title', title)
		await page.fill('#event-draft-starts', toLocalDateTimeInputValue(startDate))
		await page.fill('#event-draft-ends', toLocalDateTimeInputValue(endDate))
		await page.fill('#event-draft-capacity', '4')

		await page.click('button:has-text("Create Events")')
		await page.locator(`text=${title}`).first().waitFor({ timeout: 30000 })

		console.log('[calendar-events-flow] PASS')
	} finally {
		await context.close()
		await browser.close()
	}
}
