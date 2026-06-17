import { Buffer } from 'node:buffer'
import type { ServerResponse } from 'node:http'

import type { NodeCookies } from './NodeCookies.js'

/** Sends fetch response for auth runtime. */
export async function sendFetchResponse(
	res: ServerResponse,
	response: Response,
	cookies?: NodeCookies
): Promise<void> {
	for (const [ name, value ] of response.headers) {
		if (name.toLowerCase() !== 'set-cookie') {
			res.setHeader(name, value)
		}
	}
	cookies?.writeTo(res)
	const body = Buffer.from(await response.arrayBuffer())
	if (!res.hasHeader('content-length')) {
		res.setHeader('content-length', body.length)
	}
	res.writeHead(response.status)
	res.end(body)
}
