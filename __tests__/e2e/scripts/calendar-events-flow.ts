import { execSync } from 'node:child_process'
import { chromium } from 'playwright'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3610'
const ADMIN_URL = `${BASE_URL}/admin/`

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
		await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })

		const alreadyAuthed = (await page.locator('.admin-page__sidebar').count()) > 0
		if (!alreadyAuthed && (await page.locator('.admin-login').count()) > 0) {
			await page.fill('input[name="password"]', passcode)
			const navWait = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null)
			await page.click('button[type="submit"]')
			await navWait
		}

		const cookies = await context.cookies(ADMIN_URL)
		const hasSessionCookie = cookies.some((cookie) => cookie.name === 'admin_session')
		if (!hasSessionCookie) throw new Error('admin session cookie missing after login')

		await page.goto(`${BASE_URL}/admin/events`, { waitUntil: 'domcontentloaded', timeout: 30000 })
		await page.locator('.admin-page__sidebar').first().waitFor({ timeout: 30000 })
		await page.locator('.admin-page__title').first().waitFor({ timeout: 30000 })

		const title = `E2E Calendar Event ${Date.now()}`
		const waitlistTitle = `E2E Waitlist Event ${Date.now()}`
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

		await page.fill('#event-draft-title', waitlistTitle)
		await page.fill('#event-draft-starts', toLocalDateTimeInputValue(new Date(startDate.getTime() + 2 * 60 * 60 * 1000)))
		await page.fill('#event-draft-ends', toLocalDateTimeInputValue(new Date(endDate.getTime() + 2 * 60 * 60 * 1000)))
		await page.fill('#event-draft-capacity', '1')
		await page.click('button:has-text("Create Events")')
		await page.locator(`text=${waitlistTitle}`).first().waitFor({ timeout: 30000 })

		const bootstrapRes = await context.request.post(`${BASE_URL}/api/test/calendar-session`, {
			headers: { authorization: `Bearer ${passcode}` },
			data: { email: `e2e-calendar-${Date.now()}@example.com`, name: 'E2E Calendar User' }
		})
		if (!bootstrapRes.ok()) {
			throw new Error(`calendar member bootstrap failed: ${bootstrapRes.status()}`)
		}

		await page.goto(`${BASE_URL}/calendar/gym`, { waitUntil: 'domcontentloaded', timeout: 30000 })
		if (page.url().includes('/calendar/login')) throw new Error('calendar member session bootstrap did not stick')

		const mainCard = page.locator('.calendar-home__event-card', { hasText: title }).first()
		await mainCard.waitFor({ timeout: 30000 })
		await mainCard.locator('button:has-text("Join +1")').click()
		await page.waitForTimeout(250)
		await mainCard.locator('text=2/4 seats').first().waitFor({ timeout: 30000 })
		await mainCard.locator('button:has-text("Leave")').click()
		await page.waitForTimeout(250)
		await mainCard.locator('text=0/4 seats').first().waitFor({ timeout: 30000 })

		const waitlistCard = page.locator('.calendar-home__event-card', { hasText: waitlistTitle }).first()
		await waitlistCard.waitFor({ timeout: 30000 })
		const feedRes = await context.request.get(`${BASE_URL}/api/calendar/events`)
		if (!feedRes.ok()) throw new Error(`failed to load calendar events feed: ${feedRes.status()}`)
		const feedJson = await feedRes.json() as { upcoming?: Array<{ id: number; title: string }> }
		const waitlistEvent = (feedJson.upcoming ?? []).find((event) => event.title === waitlistTitle)
		if (!waitlistEvent) throw new Error('waitlist event not found in feed')
		const waitlistJoinRes = await context.request.post(`${BASE_URL}/api/calendar/events/${waitlistEvent.id}/join`, {
			data: { guestCount: 1 }
		})
		if (!waitlistJoinRes.ok()) throw new Error(`waitlist join failed: ${waitlistJoinRes.status()}`)
		await page.reload({ waitUntil: 'domcontentloaded' })
		await waitlistCard.locator('text=waitlist 1').first().waitFor({ timeout: 30000 })
		await waitlistCard.locator('button:has-text("Leave")').click()
		await page.waitForTimeout(250)
		await waitlistCard.locator('text=0/1 seats').first().waitFor({ timeout: 30000 })

		console.log('[calendar-events-flow] PASS')
	} finally {
		await context.close()
		await browser.close()
	}
}
