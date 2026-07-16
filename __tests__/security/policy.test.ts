import { error as httpError, redirect } from '@sveltejs/kit'
import { describe, expect, it, vi } from 'vitest'

import { MemoryCsrfStore } from '../../src/security/csrf.ts'
import { applySecurityPolicy } from '../../src/security/policy.ts'
import type { RequestEventLike } from '../../src/types/auth.ts'
import { createCookies, createRequestEvent } from '../testKit.ts'

function createEvent({
	method = 'POST',
	headers = {},
	cookies = createCookies(),
	clientAddress = '127.0.0.1'
}: {
	method?: string
	headers?: Record<string, string>
	cookies?: ReturnType<typeof createCookies>
	clientAddress?: string
} = {}): RequestEventLike {
	return {
		...createRequestEvent({
			url: 'http://localhost/auth/test',
			method,
			headers,
			cookies,
			locals: { user: null, session: null }
		}),
		getClientAddress: () => clientAddress
	}
}

function createAuditSettings(emitter: ReturnType<typeof vi.fn>) {
	return {
		csrf: {
			mode: 'off' as const,
			cookieName: 'csrf-token',
			headerName: 'x-csrf-token',
			checkExpiry: false
		},
		rateLimit: {
			mode: 'off' as const,
			windows: [{ name: 'audit', maxEvents: 10, windowMs: 60_000 }],
			keyPrefix: 'test-audit',
			trustedProxyHeaders: []
		},
		audit: { mode: 'required' as const, emitter },
		routes: {}
	}
}

describe('security policy wrapper', () => {
	it('blocks missing csrf token when required', async () => {
		const handler = applySecurityPolicy({
			handler: async () => new Response(JSON.stringify({ ok: true })),
			routeId: 'magic.request',
			settings: {
				csrf: {
					mode: 'required',
					cookieName: 'csrf-token',
					headerName: 'x-csrf-token',
					checkExpiry: false,
					store: new MemoryCsrfStore()
				},
				rateLimit: {
					mode: 'off',
					windows: [{ name: 'test', maxEvents: 10, windowMs: 60_000 }],
					keyPrefix: 'test',
					trustedProxyHeaders: []
				},
				audit: { mode: 'off' },
				routes: {}
			}
		})
		const response = await handler(createEvent() as Parameters<typeof handler>[0])
		expect(response.status).toBe(403)
	})

	it('rate limits repeated requests', async () => {
		const cookies = createCookies({
			'csrf-token': 'token'
		})
		const handler = applySecurityPolicy({
			handler: async () => new Response(JSON.stringify({ ok: true })),
			routeId: 'magic.request',
			settings: {
				csrf: {
					mode: 'required',
					cookieName: 'csrf-token',
					headerName: 'x-csrf-token',
					checkExpiry: false,
					store: new MemoryCsrfStore()
				},
				rateLimit: {
					mode: 'required',
					windows: [{ name: 'test', maxEvents: 1, windowMs: 60_000 }],
					keyPrefix: 'test',
					trustedProxyHeaders: []
				},
				audit: { mode: 'off' },
				routes: {}
			}
		})
		const first = await handler(
			createEvent({
				headers: { 'x-csrf-token': 'token' },
				cookies
			}) as Parameters<typeof handler>[0]
		)
		const second = await handler(
			createEvent({
				headers: { 'x-csrf-token': 'token' },
				cookies
			}) as Parameters<typeof handler>[0]
		)
		expect(first.status).toBe(200)
		expect(second.status).toBe(429)
	})

	it('uses the first forwarded ip when proxy headers are trusted', async () => {
		const handler = applySecurityPolicy({
			handler: async () => new Response(JSON.stringify({ ok: true })),
			routeId: 'magic.request',
			settings: {
				csrf: {
					mode: 'off',
					cookieName: 'csrf-token',
					headerName: 'x-csrf-token',
					checkExpiry: false
				},
				rateLimit: {
					mode: 'required',
					windows: [{ name: 'test', maxEvents: 1, windowMs: 60_000 }],
					keyPrefix: 'test-forwarded',
					trustedProxyHeaders: ['x-forwarded-for']
				},
				audit: { mode: 'off' },
				routes: {}
			}
		})
		const first = await handler(
			createEvent({
				headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.2' },
				clientAddress: '10.0.0.1'
			}) as Parameters<typeof handler>[0]
		)
		const secondSameForwardedIp = await handler(
			createEvent({
				headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.3' },
				clientAddress: '10.0.0.99'
			}) as Parameters<typeof handler>[0]
		)
		const thirdDifferentForwardedIp = await handler(
			createEvent({
				headers: { 'x-forwarded-for': '203.0.113.11' },
				clientAddress: '10.0.0.1'
			}) as Parameters<typeof handler>[0]
		)

		expect(first.status).toBe(200)
		expect(secondSameForwardedIp.status).toBe(429)
		expect(thirdDifferentForwardedIp.status).toBe(200)
	})

	it('uses the Cloudflare connecting ip when explicitly trusted', async () => {
		const handler = applySecurityPolicy({
			handler: async () => new Response(JSON.stringify({ ok: true })),
			routeId: 'magic.request',
			settings: {
				csrf: {
					mode: 'off',
					cookieName: 'csrf-token',
					headerName: 'x-csrf-token',
					checkExpiry: false
				},
				rateLimit: {
					mode: 'required',
					windows: [{ name: 'test', maxEvents: 1, windowMs: 60_000 }],
					keyPrefix: 'test-cloudflare',
					trustedProxyHeaders: ['cf-connecting-ip']
				},
				audit: { mode: 'off' },
				routes: {}
			}
		})
		const first = await handler(
			createEvent({
				headers: {
					'cf-connecting-ip': '198.51.100.10',
					'x-forwarded-for': '203.0.113.10, 10.0.0.2'
				},
				clientAddress: '10.0.0.1'
			}) as Parameters<typeof handler>[0]
		)
		const secondSameCloudflareIp = await handler(
			createEvent({
				headers: {
					'cf-connecting-ip': '198.51.100.10',
					'x-forwarded-for': '203.0.113.11, 10.0.0.3'
				},
				clientAddress: '10.0.0.99'
			}) as Parameters<typeof handler>[0]
		)
		const thirdDifferentCloudflareIp = await handler(
			createEvent({
				headers: {
					'cf-connecting-ip': '198.51.100.11',
					'x-forwarded-for': '203.0.113.10'
				},
				clientAddress: '10.0.0.1'
			}) as Parameters<typeof handler>[0]
		)

		expect(first.status).toBe(200)
		expect(secondSameCloudflareIp.status).toBe(429)
		expect(thirdDifferentCloudflareIp.status).toBe(200)
	})

	it('ignores untrusted forwarded headers', async () => {
		const handler = applySecurityPolicy({
			handler: async () => new Response(JSON.stringify({ ok: true })),
			routeId: 'magic.request',
			settings: {
				csrf: {
					mode: 'off',
					cookieName: 'csrf-token',
					headerName: 'x-csrf-token',
					checkExpiry: false
				},
				rateLimit: {
					mode: 'required',
					windows: [{ name: 'test', maxEvents: 1, windowMs: 60_000 }],
					keyPrefix: 'test-untrusted-forwarded',
					trustedProxyHeaders: ['cf-connecting-ip']
				},
				audit: { mode: 'off' },
				routes: {}
			}
		})
		const first = await handler(
			createEvent({
				headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.2' },
				clientAddress: '10.0.0.1'
			}) as Parameters<typeof handler>[0]
		)
		const secondSameForwardedIp = await handler(
			createEvent({
				headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.3' },
				clientAddress: '10.0.0.99'
			}) as Parameters<typeof handler>[0]
		)

		expect(first.status).toBe(200)
		expect(secondSameForwardedIp.status).toBe(200)
	})

	it('audits redirects as successful control flow', async () => {
		const emitter = vi.fn()
		const handler = applySecurityPolicy({
			handler: async () => {
				throw redirect(303, '/')
			},
			routeId: 'auth.logout',
			settings: createAuditSettings(emitter)
		})

		await expect(handler(createEvent() as Parameters<typeof handler>[0])).rejects.toMatchObject({
			status: 303,
			location: '/'
		})
		expect(emitter).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'auth.success', severity: 'info', status: 303 })
		)
		expect(emitter).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'auth.failure' }))
	})

	it('preserves expected HTTP failure status and severity in audit events', async () => {
		const emitter = vi.fn()
		const handler = applySecurityPolicy({
			handler: async () => {
				throw httpError(403, 'Forbidden')
			},
			routeId: 'sessions.revoke',
			settings: createAuditSettings(emitter)
		})

		await expect(handler(createEvent() as Parameters<typeof handler>[0])).rejects.toMatchObject({
			status: 403
		})
		expect(emitter).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'auth.failure', severity: 'warn', status: 403 })
		)
	})
})
