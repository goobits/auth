import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../../_bridge.ts'
import { enforceSameOrigin, requireAdminSession, unauthorized } from '../../../admin/_helpers.ts'
import { parseDiscordWebhookTextInput, TransportValidationError } from '@miko/calendar'
import { apiOk, apiError, apiValidationError, logApiError } from '$lib/server/http/api'

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
			return apiError('DISCORD_WEBHOOK_URL not configured', { status: 400 })
		}

		const { text } = parseDiscordWebhookTextInput(await event.request.json().catch(() => null))

		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content: text })
		})
		if (!response.ok) {
			return apiError(`Discord webhook failed (${response.status})`, { status: 502 })
		}

		return apiOk({})
	} catch (err) {
		if (err instanceof TransportValidationError) {
			return apiValidationError(err)
		}
		logApiError('calendar.webhook.discord', err)
		return apiError('Internal server error')
	}
}
