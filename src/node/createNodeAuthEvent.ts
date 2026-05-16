import type { IncomingMessage } from 'node:http'

import type { RequestEventLike } from '../types/auth.js'
import { NodeCookies } from './nodeCookies.js'

export async function createNodeAuthEvent({
	body,
	req
}: {
	body?: Buffer;
	req: IncomingMessage;
}): Promise<{ cookies: NodeCookies; event: RequestEventLike }> {
	const url = new URL(req.url || '/', `http://${ req.headers.host || '127.0.0.1' }`)
	const method = req.method || 'GET'
	const headers = new Headers()
	for (const [ name, value ] of Object.entries(req.headers)) {
		if (Array.isArray(value)) {
			for (const entry of value) {
				headers.append(name, entry)
			}
		} else if (value !== undefined) {
			headers.set(name, value)
		}
	}

	const requestInit: RequestInit = {
		headers,
		method
	}
	if (method !== 'GET' && method !== 'HEAD') {
		requestInit.body = body as BodyInit
	}
	const request = new Request(url, requestInit)
	const cookies = new NodeCookies(req)
	return {
		cookies,
		event: {
			cookies: cookies as unknown as RequestEventLike['cookies'],
			getClientAddress: () => req.socket.remoteAddress || '127.0.0.1',
			locals: {},
			params: {},
			request,
			url
		}
	}
}
