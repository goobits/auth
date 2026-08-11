import { describe, expect, it, vi } from 'vitest'

import { MemoryCsrfStore } from '@goobits/security/csrf'
import { applySecurityPolicy, createAuthCsrf } from '../../src/security/policy.ts'
import { createCookies } from '../testKit.ts'
import {
	CSRF_SECRET,
	createAuditSettings,
	createEvent,
	createPolicySettings,
	csrfSettings,
	requestOriginOff
} from './_policyTestKit.ts'

describe('security policy wrapper', () => {
	it('blocks missing csrf token when required', async () => {
		const handler = applySecurityPolicy({
			handler: async () => new Response(JSON.stringify({ ok: true })),
			routeId: 'magic.request',
			settings: {
				...createPolicySettings({ csrfMode: 'required' }),
				csrf: {
					...csrfSettings('required'),
					store: new MemoryCsrfStore()
				}
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
			settings: createPolicySettings({ rateLimitMode: 'required' })
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
		expect(second.headers.get('retry-after')).toMatch(/^\d+$/)
	})

	it('executes a custom request-origin boundary before rate limits and delegated state changes', async () => {
		const inner = vi.fn(async () => new Response('ok'))
		const validate = vi.fn(async () => false)
		const handler = applySecurityPolicy({
			handler: inner,
			routeId: 'auth.logout',
			settings: {
				...createAuditSettings(vi.fn()),
				requestOrigin: { mode: 'required', allowedOrigins: [], validate },
				rateLimit: {
					mode: 'required',
					windows: [{ name: 'origin-order', maxEvents: 1, windowMs: 60_000 }],
					keyPrefix: 'origin-order',
					trustedProxyHeaders: []
				}
			}
		})
		const event = createEvent()

		const response = await handler(event as Parameters<typeof handler>[0])
		expect(response.status).toBe(403)
		expect(validate).toHaveBeenCalledWith(event)
		expect(inner).not.toHaveBeenCalled()

		validate.mockResolvedValue(true)
		const sameClientResponse = await handler(event as Parameters<typeof handler>[0])
		expect(sameClientResponse.status).toBe(200)
		expect(inner).toHaveBeenCalledOnce()
	})

	it('enforces same-origin browser context by default and exempts the OAuth callback', async () => {
		const base = {
			...createAuditSettings(vi.fn()),
			requestOrigin: { mode: 'required' as const, allowedOrigins: [] }
		}
		const guarded = applySecurityPolicy({
			handler: async () => new Response('ok'),
			routeId: 'auth.logout',
			settings: base
		})

		await expect(
			guarded(createEvent({ headers: { origin: 'http://localhost' } }))
		).resolves.toMatchObject({ status: 200 })
		await expect(guarded(createEvent())).resolves.toMatchObject({ status: 403 })
		await expect(
			guarded(
				createEvent({
					headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' }
				})
			)
		).resolves.toMatchObject({ status: 403 })

		const callback = applySecurityPolicy({
			handler: async () => new Response('ok'),
			routeId: 'oauth.callback',
			settings: { ...base, routes: { 'oauth.callback': { requestOrigin: 'off' } } }
		})
		await expect(callback(createEvent())).resolves.toMatchObject({ status: 200 })
	})

	it('ignores spoofed left entries when one append-style proxy hop is trusted', async () => {
		const handler = applySecurityPolicy({
			handler: async () => new Response(JSON.stringify({ ok: true })),
			routeId: 'magic.request',
			settings: createPolicySettings({
				rateLimitMode: 'required',
				keyPrefix: 'test-forwarded',
				trustedProxyHeaders: ['x-forwarded-for'],
				forwardedForTrustedProxyHops: 1
			})
		})
		const first = await handler(
			createEvent({
				headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.10' },
				clientAddress: '10.0.0.1'
			}) as Parameters<typeof handler>[0]
		)
		const secondSameForwardedIp = await handler(
			createEvent({
				headers: { 'x-forwarded-for': '198.51.100.2, 203.0.113.10' },
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

	it('enforces optional csrf after a token cookie has been issued', async () => {
		const handler = applySecurityPolicy({
			handler: async () => new Response(JSON.stringify({ ok: true })),
			routeId: 'magic.request',
			settings: createPolicySettings({ csrfMode: 'optional', keyPrefix: 'test-optional' })
		})

		await expect(handler(createEvent() as Parameters<typeof handler>[0])).resolves.toMatchObject({
			status: 200
		})
		await expect(
			handler(
				createEvent({
					cookies: createCookies({ 'csrf-token': 'issued-token' })
				}) as Parameters<typeof handler>[0]
			)
		).resolves.toMatchObject({ status: 403 })
	})

	it('accepts the canonical csrf_token form field', async () => {
		const cookies = createCookies()
		const settings = createPolicySettings({ csrfMode: 'required', keyPrefix: 'test-form' })
		const token = await createAuthCsrf(settings).generate(
			createEvent({ method: 'GET', cookies }) as never
		)
		const handler = applySecurityPolicy({
			handler: async () => new Response(JSON.stringify({ ok: true })),
			routeId: 'auth.logout',
			settings
		})
		const event = createEvent({ cookies })
		event.request = new Request('http://localhost/auth/test', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ csrf_token: token })
		})

		await expect(handler(event as Parameters<typeof handler>[0])).resolves.toMatchObject({
			status: 200
		})
	})

	it('uses the Cloudflare connecting ip when explicitly trusted', async () => {
		const handler = applySecurityPolicy({
			handler: async () => new Response(JSON.stringify({ ok: true })),
			routeId: 'magic.request',
			settings: createPolicySettings({
				rateLimitMode: 'required',
				keyPrefix: 'test-cloudflare',
				trustedProxyHeaders: ['cf-connecting-ip']
			})
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
			settings: createPolicySettings({
				rateLimitMode: 'required',
				keyPrefix: 'test-untrusted-forwarded',
				trustedProxyHeaders: ['cf-connecting-ip']
			})
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
})
