import { Buffer } from 'node:buffer'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { describe, expect, it } from 'vitest'

import {
	createNodeAuthEvent,
	NodeCookies,
	readRequestBody,
	sendFetchResponse
} from '../../src/node/index.ts'

describe('node http bridge', () => {
	it('creates RequestEventLike objects from IncomingMessage-shaped requests', async () => {
		const req = {
			headers: {
				cookie: 'session=abc',
				host: 'example.test'
			},
			method: 'POST',
			socket: {
				remoteAddress: '10.0.0.1'
			},
			url: '/auth/signout'
		} as unknown as IncomingMessage

		const { event } = await createNodeAuthEvent({
			body: Buffer.from('body'),
			req
		})

		expect(event.url.pathname).toBe('/auth/signout')
		expect(event.request.method).toBe('POST')
		expect(event.cookies.get('session')).toBe('abc')
		expect(event.getClientAddress?.()).toBe('10.0.0.1')
	})

	it('reads request bodies and forwards fetch responses', async () => {
		const body = await readRequestBody([Buffer.from('a'), 'b'])
		expect(body.toString('utf8')).toBe('ab')

		const headers = new Map<string, string | string[] | number>()
		let status = 0
		let ended = Buffer.alloc(0)
		const res = {
			end(data: Buffer) {
				ended = data
			},
			hasHeader(name: string) {
				return headers.has(name.toLowerCase())
			},
			setHeader(name: string, value: string | string[] | number) {
				headers.set(name.toLowerCase(), value)
			},
			writeHead(nextStatus: number) {
				status = nextStatus
			}
		} as unknown as ServerResponse
		const req = {
			headers: {}
		} as IncomingMessage
		const cookies = new NodeCookies(req)
		cookies.set('session', 'next', { httpOnly: true, path: '/' })

		await sendFetchResponse(res, new Response('ok', { status: 201 }), cookies)

		expect(status).toBe(201)
		expect(ended.toString('utf8')).toBe('ok')
		expect(headers.get('set-cookie')).toEqual(['session=next; Path=/; HttpOnly'])
	})
})
