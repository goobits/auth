#!/usr/bin/env node
import { chromium } from 'playwright'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3610'
const ROUTES = [
	'/',
	'/about',
	'/labs',
	'/journal',
	'/contact',
	'/privacy',
	'/terms',
	'/cookies',
	'/calendar/login',
	'/admin'
]

const MAX_DELTA_PX = Number.parseFloat(process.env.E2E_DRIFT_MAX_PX || '1.0')
const POST_LOAD_SETTLE_MS = Number.parseInt(process.env.E2E_DRIFT_SETTLE_MS || '800', 10)
const DEBUG = process.env.E2E_DRIFT_DEBUG === '1'

function round1(n) {
	return Math.round(n * 10) / 10
}

export async function runLayoutDrift() {
	const browser = await chromium.launch({ headless: true })
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

	try {
		let failed = 0

		for (const route of ROUTES) {
			const page = await context.newPage()

			const url = `${BASE_URL}${route}`
			const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
			if (!res) throw new Error(`No response for ${url}`)
			if (res.status() >= 500) throw new Error(`Server error for ${url}: ${res.status()}`)

			// In dev, CSS can be injected over a few ticks after DOMContentLoaded.
			// Define "first available" as "stylesheets stable + tokens present" to avoid flake
			// and to measure drift after the page is actually styled.
			await page.evaluate(async () => {
				const hasTokens = () => {
					const v = getComputedStyle(document.documentElement).getPropertyValue('--max-width')
					return v && v.trim().length > 0
				}

				let lastLen = document.styleSheets.length
				let stableFor = 0
				let lastTs = performance.now()

				while (stableFor < 250 || !hasTokens()) {
					await new Promise((r) => requestAnimationFrame(() => r()))
					const now = performance.now()
					const len = document.styleSheets.length
					if (len !== lastLen) {
						lastLen = len
						stableFor = 0
						lastTs = now
					} else {
						stableFor = now - lastTs
					}
				}
			})

			// Snapshot "early": as close to first usable render as we can get, but after one frame.
			const early = await page.evaluate(async () => {
				const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()))
				await nextFrame()

				const pick = (sel) => {
					const el = document.querySelector(sel)
					if (!el) return null
					const r = el.getBoundingClientRect()
					return {
						sel,
						x: r.x,
						y: r.y,
						w: r.width,
						h: r.height
					}
				}

				const rects = [
					pick('header'),
					pick('main'),
					pick('.ui-hero'),
					pick('.about-page__intro'),
					pick('.about-page__bio'),
					pick('h1'),
					pick('.ui-shell')
				].filter(Boolean)

				const csBody = getComputedStyle(document.body)
				const csH1 = document.querySelector('h1') ? getComputedStyle(document.querySelector('h1')) : null

				return {
					theme: document.documentElement.getAttribute('data-theme') || '',
					bodyFont: csBody.fontFamily,
					h1Font: csH1?.fontFamily || '',
					rects
				}
			})

			// Snapshot "late": allow network, font loading, hydration, and transitions to settle.
			await page.waitForLoadState('networkidle', { timeout: 30000 })
			await page.evaluate(async () => {
				if (document?.fonts?.ready) await document.fonts.ready
			})
			await page.waitForTimeout(POST_LOAD_SETTLE_MS)

			const late = await page.evaluate(() => {
				const pick = (sel) => {
					const el = document.querySelector(sel)
					if (!el) return null
					const r = el.getBoundingClientRect()
					return {
						sel,
						x: r.x,
						y: r.y,
						w: r.width,
						h: r.height
					}
				}

				const rects = [
					pick('header'),
					pick('main'),
					pick('.ui-hero'),
					pick('.about-page__intro'),
					pick('.about-page__bio'),
					pick('h1'),
					pick('.ui-shell')
				].filter(Boolean)

				const csBody = getComputedStyle(document.body)
				const csH1 = document.querySelector('h1') ? getComputedStyle(document.querySelector('h1')) : null

				return {
					theme: document.documentElement.getAttribute('data-theme') || '',
					bodyFont: csBody.fontFamily,
					h1Font: csH1?.fontFamily || '',
					rects
				}
			})

			const bySelEarly = new Map(early.rects.map((r) => [r.sel, r]))
			const deltas = []

			for (const rLate of late.rects) {
				const rEarly = bySelEarly.get(rLate.sel)
				if (!rEarly) continue

				const dx = Math.abs(rLate.x - rEarly.x)
				const dy = Math.abs(rLate.y - rEarly.y)
				const dw = Math.abs(rLate.w - rEarly.w)
				const dh = Math.abs(rLate.h - rEarly.h)
				const max = Math.max(dx, dy, dw, dh)

				deltas.push({
					sel: rLate.sel,
					max,
					dx,
					dy,
					dw,
					dh
				})
			}

			deltas.sort((a, b) => b.max - a.max)
			const worst = deltas[0] || { sel: '(none)', max: 0, dx: 0, dy: 0, dw: 0, dh: 0 }
			const ok = worst.max <= MAX_DELTA_PX

			// eslint-disable-next-line no-console
			console.log(
				`[drift] ${route.padEnd(16)} max=${round1(worst.max)}px sel=${worst.sel} ` +
					`dx=${round1(worst.dx)} dy=${round1(worst.dy)} dw=${round1(worst.dw)} dh=${round1(worst.dh)} ` +
					`${ok ? 'OK' : 'FAIL'}`
			)

			if (!ok) {
				failed++
				// eslint-disable-next-line no-console
				console.log(
					`[drift]   fonts: body "${early.bodyFont}" -> "${late.bodyFont}", h1 "${early.h1Font}" -> "${late.h1Font}"; ` +
						`theme "${early.theme}" -> "${late.theme}"`
				)
				if (DEBUG) {
					const er = bySelEarly.get(worst.sel)
					const lr = late.rects.find((r) => r.sel === worst.sel)
					// eslint-disable-next-line no-console
					console.log('[drift]   earlyRect:', er ? { ...er } : null)
					// eslint-disable-next-line no-console
					console.log('[drift]   lateRect :', lr ? { ...lr } : null)
				}
			}

			await page.close()
		}

		if (failed) {
			throw new Error(`Layout drift regression: ${failed} route(s) exceeded MAX_DELTA_PX=${MAX_DELTA_PX}`)
		}

		// eslint-disable-next-line no-console
		console.log(`[drift] OK: all routes <= ${MAX_DELTA_PX}px`)
	} finally {
		await context.close()
		await browser.close()
	}
}
