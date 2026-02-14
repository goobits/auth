import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

type ContactBody = {
	name: string
	email: string
	message: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isContactBody(input: unknown): input is ContactBody {
	if (typeof input !== 'object' || input === null) return false
	const record = input as Record<string, unknown>
	return (
		typeof record['name'] === 'string' &&
		typeof record['email'] === 'string' &&
		typeof record['message'] === 'string'
	)
}

function sanitize(body: ContactBody): ContactBody {
	return {
		name: body.name.trim(),
		email: body.email.trim(),
		message: body.message.trim()
	}
}

export const POST: RequestHandler = async ({ request, platform }) => {
	let payload: unknown
	try {
		payload = await request.json()
	} catch {
		return json({ ok: false, error: 'Invalid request body.' }, { status: 400 })
	}

	if (!isContactBody(payload)) {
		return json({ ok: false, error: 'Missing required fields.' }, { status: 400 })
	}

	const body = sanitize(payload)
	if (!body.name || !body.message || !EMAIL_RE.test(body.email)) {
		return json({ ok: false, error: 'Please provide a valid name, email, and message.' }, { status: 400 })
	}

	const envWebhook = platform?.env?.['CONTACT_WEBHOOK_URL']
	const processWebhook = process.env['CONTACT_WEBHOOK_URL']
	const webhook = typeof envWebhook === 'string' ? envWebhook : typeof processWebhook === 'string' ? processWebhook : ''

	if (!webhook) {
		console.info('[contact] message accepted (no CONTACT_WEBHOOK_URL configured)', {
			from: body.email,
			name: body.name,
			length: body.message.length
		})
		return json({ ok: true }, { status: 202 })
	}

	const response = await fetch(String(webhook), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			event: 'miko-contact-form',
			source: 'miko.art',
			sentAt: new Date().toISOString(),
			...body
		})
	})

	if (!response.ok) {
		return json({ ok: false, error: 'Contact delivery failed.' }, { status: 502 })
	}

	return json({ ok: true }, { status: 200 })
}
