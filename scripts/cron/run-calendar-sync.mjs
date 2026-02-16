#!/usr/bin/env node
import process from 'node:process'

const baseUrl = process.env.CALENDAR_SYNC_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:3610'
const secret = process.env.CALENDAR_SYNC_CRON_SECRET || process.env.ADMIN_PASSCODE || ''
const limit = Number.parseInt(process.env.CALENDAR_SYNC_LIMIT || '20', 10)

if (!secret) {
	console.error('[calendar-sync] missing CALENDAR_SYNC_CRON_SECRET (or ADMIN_PASSCODE fallback)')
	process.exit(1)
}

const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/internal/calendar/sync`
const response = await fetch(endpoint, {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		authorization: `Bearer ${secret}`
	},
	body: JSON.stringify({ limit: Number.isFinite(limit) ? limit : 20 })
})

const payload = await response.json().catch(() => ({}))
if (!response.ok || !payload?.ok) {
	console.error('[calendar-sync] failed', { status: response.status, payload })
	process.exit(1)
}

console.log('[calendar-sync] ok', payload)
