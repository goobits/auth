export class ApiClientError extends Error {
	status: number
	code?: string
	payload?: unknown

	constructor(message: string, status: number, payload?: unknown, code?: string) {
		super(message)
		this.name = 'ApiClientError'
		this.status = status
		this.payload = payload
		if (typeof code === 'string') {
			this.code = code
		}
	}
}

type RequestOptions = RequestInit & {
	expectOk?: boolean
}

function getPayloadError(payload: unknown) {
	if (!payload || typeof payload !== 'object' || !('error' in payload)) return null
	const candidate = payload.error
	if (!candidate || typeof candidate !== 'object') return null
	return candidate as { message?: unknown; code?: unknown }
}

export async function requestApi<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
	const { expectOk = true, ...init } = options
	const response = await fetch(url, init)
	let payload: unknown = null

	try {
		payload = await response.json()
	} catch {
		payload = null
	}

	if (!response.ok) {
		const payloadError = getPayloadError(payload)
		const message = typeof payloadError?.message === 'string'
			? payloadError.message
			: `Request failed (${response.status})`
		const code = typeof payloadError?.code === 'string' ? payloadError.code : undefined
		throw new ApiClientError(message, response.status, payload, code)
	}

	if (expectOk && payload && typeof payload === 'object' && 'ok' in payload && payload.ok === false) {
		const payloadError = getPayloadError(payload)
		const message = typeof payloadError?.message === 'string' ? payloadError.message : 'Request failed'
		const code = typeof payloadError?.code === 'string' ? payloadError.code : undefined
		throw new ApiClientError(message, response.status, payload, code)
	}

	return payload as T
}
