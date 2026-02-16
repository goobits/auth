import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../_bridge.ts'
import { enforceSameOrigin, noStoreHeaders, requireAdminSession, unauthorized } from '../../../admin/_helpers.ts'
import { parseDiscordWebhookTextInput, TransportValidationError } from '@packages/calendar/src/index.ts'

export async function POST(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const env = await buildEnv(event.platform)
		const discordWebhook = env['DISCORD_WEBHOOK_URL']
		const webhookUrl = typeof discordWebhook === 'string' ? discordWebhook : ''
		if (!webhookUrl) {
			return json({ ok: false, error: { message: 'DISCORD_WEBHOOK_URL not configured' } }, { status: 400, headers: noStoreHeaders })
		}

		const { text } = parseDiscordWebhookTextInput(await event.request.json().catch(() => null))

		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content: text })
		})
		if (!response.ok) {
			return json({ ok: false, error: { message: `Discord webhook failed (${response.status})` } }, { status: 502, headers: noStoreHeaders })
		}

		return json({ ok: true }, { headers: noStoreHeaders })
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return json({ ok: false, error: { message: err.message } }, { status: err.status, headers: noStoreHeaders })
		}
		console.error('Discord webhook error:', err)
		return json({ ok: false, error: { message: 'Internal server error' } }, { status: 500, headers: noStoreHeaders })
	}
}
