import type { IncomingMessage, ServerResponse } from 'node:http'

type CookieOptions = {
	domain?: string
	expires?: Date
	httpOnly?: boolean
	maxAge?: number
	path?: string
	sameSite?: 'strict' | 'lax' | 'none' | boolean
	secure?: boolean
}

/** Node HTTP cookie adapter compatible with SvelteKit-style cookie APIs. */
export class NodeCookies {
	#cookies: Map<string, string>
	#setCookieHeaders: string[] = []

	constructor(req: IncomingMessage) {
		this.#cookies = parseCookieHeader(req.headers.cookie)
	}

	get(name: string): string | undefined {
		return this.#cookies.get(name)
	}

	getAll(name?: string): Array<{ name: string; value: string }> {
		return [...this.#cookies.entries()]
			.filter(([cookieName]) => !name || cookieName === name)
			.map(([cookieName, value]) => ({
				name: cookieName,
				value
			}))
	}

	serialize(name: string, value: string, options: CookieOptions = {}): string {
		return serializeCookie(name, value, options)
	}

	set(name: string, value: string, options: CookieOptions = {}): void {
		this.#cookies.set(name, value)
		this.#setCookieHeaders.push(serializeCookie(name, value, options))
	}

	delete(name: string, options: CookieOptions = {}): void {
		this.#cookies.delete(name)
		this.#setCookieHeaders.push(
			serializeCookie(name, '', {
				...options,
				expires: new Date(0),
				maxAge: 0
			})
		)
	}

	writeTo(res: ServerResponse): void {
		if (this.#setCookieHeaders.length) {
			res.setHeader('set-cookie', this.#setCookieHeaders)
		}
	}
}

function parseCookieHeader(header: string | undefined): Map<string, string> {
	const cookies = new Map<string, string>()
	if (!header) {
		return cookies
	}
	for (const part of header.split(';')) {
		const [rawName, ...rest] = part.trim().split('=')
		if (!rawName || !rest.length) {
			continue
		}
		cookies.set(rawName, decodeURIComponent(rest.join('=')))
	}
	return cookies
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
	const parts = [`${name}=${encodeURIComponent(value)}`]
	if (options.maxAge !== undefined) {
		parts.push(`Max-Age=${Math.trunc(options.maxAge)}`)
	}
	if (options.expires) {
		parts.push(`Expires=${options.expires.toUTCString()}`)
	}
	if (options.path) {
		parts.push(`Path=${options.path}`)
	}
	if (options.domain) {
		parts.push(`Domain=${options.domain}`)
	}
	if (options.httpOnly) {
		parts.push('HttpOnly')
	}
	if (options.secure) {
		parts.push('Secure')
	}
	if (options.sameSite) {
		parts.push(`SameSite=${options.sameSite === true ? 'Strict' : capitalize(options.sameSite)}`)
	}
	return parts.join('; ')
}

function capitalize(value: string): string {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}
