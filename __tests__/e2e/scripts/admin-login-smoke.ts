import { execSync } from 'node:child_process'
import { chromium } from 'playwright'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3610'
const ADMIN_URL = `${BASE_URL}/admin/`

function getAdminPasscode() {
	if (process.env.ADMIN_PASSCODE) return process.env.ADMIN_PASSCODE
	try {
		// Pull the decrypted value from the same env file used by dev/build scripts.
		return execSync('pnpm exec dotenvx get ADMIN_PASSCODE -f config/env/.env', {
			stdio: ['ignore', 'pipe', 'ignore']
		})
			.toString('utf8')
			.trim()
	} catch {
		return ''
	}
}

export async function runAdminLoginSmoke() {
	const passcode = getAdminPasscode()
	if (!passcode) throw new Error('ADMIN_PASSCODE not available (set env var or configure config/env/.env)')

	const browser = await chromium.launch({ headless: true })
	const context = await browser.newContext()
	const page = await context.newPage()

	try {
		await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })

		// If already authed, we're done.
		const alreadyAuthed = (await page.locator('.admin-page__sidebar').count()) > 0
		if (alreadyAuthed) {
			console.log('[admin-login-smoke] PASS (already authed)')
			return
		}

		const hasLogin = (await page.locator('.admin-login').count()) > 0
		if (!hasLogin) throw new Error('admin login form not found')

		// UI-driven login (real form submit + redirect).
		await page.fill('input[name="password"]', passcode)
		const navWait = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null)
		await page.click('button[type="submit"]')
		await navWait

		// Ensure the cookie actually landed in the browser context, then load /admin/ fresh.
		// This avoids flake around action redirect handling and guarantees hooks run on the GET.
		const cookies = await context.cookies(ADMIN_URL)
		const hasSessionCookie = cookies.some(c => c.name === 'admin_session')
		if (!hasSessionCookie) {
			// Fallback: perform the login via context.request to capture a useful failure mode.
			const res = await context.request.post(`${BASE_URL}/admin/?/login`, {
				form: { email: 'admin@miko.art', password: passcode },
				headers: { accept: 'text/html' }
			})
			throw new Error(`admin_session cookie missing after login (ui). fallback_status=${res.status()}`)
		}

		await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
		await page.locator('.admin-page__sidebar').first().waitFor({ timeout: 30000 })

		const hasSidebar = (await page.locator('.admin-page__sidebar').count()) > 0
		if (!hasSidebar) {
			const errorText = await page.locator('.admin-login__error').first().textContent().catch(() => '')
			throw new Error(`expected to be authed after login, but sidebar not found. error=${JSON.stringify(errorText || '')}`)
		}

		console.log('[admin-login-smoke] PASS')
	} finally {
		await context.close()
		await browser.close()
	}
}
