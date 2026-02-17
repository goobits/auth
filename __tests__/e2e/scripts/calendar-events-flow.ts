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

async function waitForFeedEvent(
	request: import('playwright').APIRequestContext,
	baseUrl: string,
	title: string
) {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const res = await request.get(`${baseUrl}/api/calendar/events`)
		if (res.ok()) {
			const json = await res.json() as { upcoming?: Array<{ id: number; title: string }> }
			const found = (json.upcoming ?? []).find((event) => event.title === title)
			if (found) return found
		}
		await new Promise((resolve) => setTimeout(resolve, 300))
	}
	return null
}

async function createAdminEvent(
	request: import('playwright').APIRequestContext,
	baseUrl: string,
	input: {
		activitySlug: string
		title: string
		startsAt: string
		endsAt: string
		capacity: number
	}
) {
	const response = await request.post(`${baseUrl}/api/admin/events`, {
		headers: { origin: baseUrl },
		data: {
			...input,
			repeatWeeks: 0,
			costCents: 0,
			currency: 'USD',
			paymentProvider: null,
			paymentHandle: null,
			paymentNoteTemplate: null,
			location: null,
			note: null
		}
	})
	if (!response.ok()) {
		throw new Error(`admin event create failed (${input.title}): ${response.status()}`)
	}
}

export async function runCalendarEventsFlow() {
	const passcode = getAdminPasscode()
	if (!passcode) throw new Error('ADMIN_PASSCODE not available')

	const browser = await chromium.launch({ headless: true })
	const context = await browser.newContext()
	const contextB = await browser.newContext()
	const page = await context.newPage()

	try {
		await context.request.post(`${BASE_URL}/api/test/calendar-cleanup`, {
			headers: { authorization: `Bearer ${passcode}` }
		})

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
		const contentionTitle = `E2E Contention Event ${Date.now()}`
		const startDate = new Date(Date.now() + 90 * 60 * 1000)
		startDate.setMinutes(0, 0, 0)
		startDate.setHours(Math.max(startDate.getHours(), 8))
		const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
		const draftActivitySlug = await page.inputValue('#event-draft-activity').catch(() => '')
		const activitySlug = draftActivitySlug || 'gym'

		await createAdminEvent(context.request, BASE_URL, {
			activitySlug,
			title,
			startsAt: startDate.toISOString(),
			endsAt: endDate.toISOString(),
			capacity: 4
		})
		await createAdminEvent(context.request, BASE_URL, {
			activitySlug,
			title: waitlistTitle,
			startsAt: new Date(startDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
			endsAt: new Date(endDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
			capacity: 1
		})

		const contentionStart = new Date(startDate.getTime() + 4 * 60 * 60 * 1000)
		const contentionEnd = new Date(endDate.getTime() + 4 * 60 * 60 * 1000)
		await createAdminEvent(context.request, BASE_URL, {
			activitySlug,
			title: contentionTitle,
			startsAt: contentionStart.toISOString(),
			endsAt: contentionEnd.toISOString(),
			capacity: 1
		})

		const bootstrapRes = await context.request.post(`${BASE_URL}/api/test/calendar-session`, {
			headers: { authorization: `Bearer ${passcode}` },
			data: { email: `e2e-calendar-${Date.now()}@example.com`, name: 'E2E Calendar User' }
		})
		if (!bootstrapRes.ok()) {
			throw new Error(`calendar member bootstrap failed: ${bootstrapRes.status()}`)
		}
		const bootstrapResB = await contextB.request.post(`${BASE_URL}/api/test/calendar-session`, {
			headers: { authorization: `Bearer ${passcode}` },
			data: { email: `e2e-calendar-b-${Date.now()}@example.com`, name: 'E2E Calendar User B' }
		})
		if (!bootstrapResB.ok()) {
			throw new Error(`calendar member bootstrap B failed: ${bootstrapResB.status()}`)
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

		const feedRes = await context.request.get(`${BASE_URL}/api/calendar/events`)
		if (!feedRes.ok()) throw new Error(`failed to load calendar events feed: ${feedRes.status()}`)
		const feedJson = await feedRes.json() as { upcoming?: Array<{ id: number; title: string }> }
		const waitlistEvent = (feedJson.upcoming ?? []).find((event) => event.title === waitlistTitle)
		if (!waitlistEvent) throw new Error('waitlist event not found in feed')
		const waitlistJoinRes = await context.request.post(`${BASE_URL}/api/calendar/events/${waitlistEvent.id}/join`, {
			data: { guestCount: 1 }
		})
		if (!waitlistJoinRes.ok()) throw new Error(`waitlist join failed: ${waitlistJoinRes.status()}`)
		const waitlistFeedAfterJoin = await waitForFeedEvent(context.request, BASE_URL, waitlistTitle)
		if (!waitlistFeedAfterJoin) throw new Error('waitlist event disappeared after join')
		const waitlistLeaveRes = await context.request.post(`${BASE_URL}/api/calendar/events/${waitlistEvent.id}/leave`)
		if (!waitlistLeaveRes.ok()) throw new Error(`waitlist leave failed: ${waitlistLeaveRes.status()}`)
		const waitlistFeedAfterLeaveRes = await context.request.get(`${BASE_URL}/api/calendar/events`)
		if (!waitlistFeedAfterLeaveRes.ok()) throw new Error(`failed to verify waitlist leave feed: ${waitlistFeedAfterLeaveRes.status()}`)
		const waitlistFeedAfterLeave = await waitlistFeedAfterLeaveRes.json() as {
			upcoming?: Array<{ title: string; seatsTaken: number; waitlistCount: number }>
		}
		const waitlistAfterLeave = (waitlistFeedAfterLeave.upcoming ?? []).find((event) => event.title === waitlistTitle)
		if (!waitlistAfterLeave || waitlistAfterLeave.seatsTaken !== 0 || waitlistAfterLeave.waitlistCount !== 0) {
			throw new Error('waitlist leave counters did not reset as expected')
		}

		const contentionEvent = await waitForFeedEvent(context.request, BASE_URL, contentionTitle)
		if (!contentionEvent) throw new Error('contention event not found in feed')

		const [joinARes, joinBRes] = await Promise.all([
			context.request.post(`${BASE_URL}/api/calendar/events/${contentionEvent.id}/join`, { data: { guestCount: 0 } }),
			contextB.request.post(`${BASE_URL}/api/calendar/events/${contentionEvent.id}/join`, { data: { guestCount: 0 } })
		])
		if (!joinARes.ok()) throw new Error(`contention join A failed: ${joinARes.status()}`)
		if (!joinBRes.ok()) throw new Error(`contention join B failed: ${joinBRes.status()}`)
		const joinA = await joinARes.json() as { status?: string }
		const joinB = await joinBRes.json() as { status?: string }
		const statuses = [joinA.status, joinB.status].sort().join(',')
		if (statuses !== 'joined,waitlist') {
			throw new Error(`unexpected contention statuses: ${statuses}`)
		}

		const verifyFeedRes = await context.request.get(`${BASE_URL}/api/calendar/events`)
		if (!verifyFeedRes.ok()) throw new Error(`failed to verify contention feed: ${verifyFeedRes.status()}`)
		const verifyFeed = await verifyFeedRes.json() as {
			upcoming?: Array<{ title: string; seatsTaken: number; capacity: number; waitlistCount: number }>
		}
		const verifyEvent = (verifyFeed.upcoming ?? []).find((event) => event.title === contentionTitle)
		if (!verifyEvent) throw new Error('contention event missing in verify feed')
		if (verifyEvent.seatsTaken !== 1 || verifyEvent.capacity !== 1 || verifyEvent.waitlistCount !== 1) {
			throw new Error(`unexpected contention counters: seats=${verifyEvent.seatsTaken}/${verifyEvent.capacity}, waitlist=${verifyEvent.waitlistCount}`)
		}

		console.log('[calendar-events-flow] PASS')
	} finally {
		await context.request.post(`${BASE_URL}/api/test/calendar-cleanup`, {
			headers: { authorization: `Bearer ${passcode}` }
		}).catch(() => null)
		await context.close()
		await contextB.close()
		await browser.close()
	}
}
