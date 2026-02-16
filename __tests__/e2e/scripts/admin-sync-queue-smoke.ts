import { execSync } from 'node:child_process'
import { chromium } from 'playwright'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3610'
const ADMIN_URL = `${BASE_URL}/admin/overview`

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

export async function runAdminSyncQueueSmoke() {
	const passcode = getAdminPasscode()
	if (!passcode) throw new Error('ADMIN_PASSCODE not available')

	const browser = await chromium.launch({ headless: true })
	const context = await browser.newContext()
	const page = await context.newPage()

	try {
		await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })

		const alreadyAuthed = (await page.locator('.admin-page__sidebar').count()) > 0
		if (!alreadyAuthed) {
			await page.fill('input[name="password"]', passcode)
			const navWait = page.waitForURL((url) => url.pathname.startsWith('/admin/overview'), { timeout: 30000 }).catch(() => null)
			await page.click('button[type="submit"]')
			await navWait
		}

		await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
		await page.locator('.admin-page__sidebar').first().waitFor({ timeout: 30000 })

		const statusRes = await context.request.get(`${BASE_URL}/api/admin/status`)
		if (!statusRes.ok()) throw new Error(`admin status failed: ${statusRes.status()}`)
		const statusPayload = await statusRes.json() as { syncQueue?: { deadLetter?: number } }
		const deadLetterCount = Number(statusPayload?.syncQueue?.deadLetter || 0)
		const sameOriginHeaders = {
			origin: BASE_URL,
			referer: `${BASE_URL}/admin/overview`
		}

		const processRes = await context.request.post(`${BASE_URL}/api/admin/sync-queue`, {
			headers: sameOriginHeaders,
			data: { action: 'process', limit: 5 }
		})
		if (!processRes.ok()) throw new Error(`sync queue process failed: ${processRes.status()}`)
		const processPayload = await processRes.json() as { ok?: boolean; action?: string }
		if (!processPayload.ok || processPayload.action !== 'process') {
			throw new Error(`unexpected process payload: ${JSON.stringify(processPayload)}`)
		}

		if (deadLetterCount > 0) {
			const retryRes = await context.request.post(`${BASE_URL}/api/admin/sync-queue`, {
				headers: sameOriginHeaders,
				data: { action: 'retry_dead_letters', limit: 5 }
			})
			if (!retryRes.ok()) throw new Error(`retry dead letters failed: ${retryRes.status()}`)
			const retryPayload = await retryRes.json() as { ok?: boolean; action?: string }
			if (!retryPayload.ok || retryPayload.action !== 'retry_dead_letters') {
				throw new Error(`unexpected retry payload: ${JSON.stringify(retryPayload)}`)
			}

			const purgeRes = await context.request.post(`${BASE_URL}/api/admin/sync-queue`, {
				headers: sameOriginHeaders,
				data: { action: 'purge_dead_letters', limit: 5 }
			})
			if (!purgeRes.ok()) throw new Error(`purge dead letters failed: ${purgeRes.status()}`)
			const purgePayload = await purgeRes.json() as { ok?: boolean; action?: string }
			if (!purgePayload.ok || purgePayload.action !== 'purge_dead_letters') {
				throw new Error(`unexpected purge payload: ${JSON.stringify(purgePayload)}`)
			}
		}

		console.log('[admin-sync-queue-smoke] PASS')
	} finally {
		await context.close()
		await browser.close()
	}
}
