export type ContactPayload = {
	name: string
	email: string
	message: string
	from?: string
	topic?: string
}

export type ContactSubmitResult = {
	ok: boolean
	error?: string
}

export function toContactPayload(formData: FormData): ContactPayload {
	const from = String(formData.get('from') ?? '').trim()
	const topic = String(formData.get('topic') ?? '').trim()
	return {
		name: String(formData.get('name') ?? '').trim(),
		email: String(formData.get('email') ?? '').trim(),
		message: String(formData.get('message') ?? '').trim(),
		...(from ? { from } : {}),
		...(topic ? { topic } : {})
	}
}

export async function submitContact(payload: ContactPayload): Promise<ContactSubmitResult> {
	const response = await fetch('/api/email', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	})

	if (response.ok) return { ok: true }

	let error = 'Unable to send your message right now.'
	try {
		const data = (await response.json()) as { error?: string }
		if (typeof data.error === 'string' && data.error.length > 0) error = data.error
	} catch {
		// ignore json parse errors and return generic failure
	}

	return { ok: false, error }
}
