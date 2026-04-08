import type { RequestEventLike } from '../src/types/auth.ts'

type CookieOptions = Record<string, unknown>

export function createCookies(initial: Record<string, string> = {}) {
	const store = new Map<string, { value: string; options: CookieOptions }>()

	for (const [name, value] of Object.entries(initial)) {
		store.set(name, { value, options: {} })
	}

	return {
		get: (name: string) => store.get(name)?.value ?? null,
		set: (name: string, value: string, options: CookieOptions = {}) => store.set(name, { value, options }),
		delete: (name: string) => store.delete(name),
		getAll: () => [],
		serialize: () => '',
		_store: store
	}
}

type CreateRequestEventOptions = {
	url?: string
	method?: string
	form?: Record<string, string>
	body?: BodyInit | null
	headers?: HeadersInit
	params?: Record<string, string>
	locals?: Record<string, unknown>
	cookies?: ReturnType<typeof createCookies>
}

export function createRequestEvent({
	url = 'http://localhost/',
	method = 'GET',
	form,
	body,
	headers = {},
	params = {},
	locals = {},
	cookies = createCookies()
}: CreateRequestEventOptions = {}): RequestEventLike {
	const requestHeaders = new Headers(headers)
	let requestBody = body ?? null

	if (form) {
		requestHeaders.set('Content-Type', 'application/x-www-form-urlencoded')
		requestBody = new URLSearchParams(form)
	}

	return {
		request: new Request(url, {
			method,
			headers: requestHeaders,
			body: requestBody
		}),
		cookies,
		locals,
		params,
		url: new URL(url)
	}
}

export function getRedirectLocation(err: { location?: string; headers?: Headers } | null) {
	return err?.location || err?.headers?.get?.('location')
}

export async function captureRejected<T>(promise: Promise<unknown>): Promise<T> {
	try {
		await promise
		throw new Error('Expected promise to reject')
	} catch (err) {
		return err as T
	}
}
