import { vi } from 'vitest'

function jsonResponse(body: unknown) {
	return new Response(JSON.stringify(body), {
		headers: { 'content-type': 'application/json' }
	})
}

export function createFetcher(body: unknown = { success: true, ok: true, sessions: [] }) {
	return vi.fn(async () => jsonResponse(body)) as unknown as typeof fetch
}

export function createQueuedFetcher(bodies: unknown[]) {
	let index = 0
	return vi.fn(async () => {
		if (index >= bodies.length) throw new Error('Unexpected auth client request')
		const body = bodies[index]
		index += 1
		return jsonResponse(body)
	}) as unknown as typeof fetch
}
