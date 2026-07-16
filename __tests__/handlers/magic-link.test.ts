import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	createMagicLinkRequestHandler,
	createMagicLinkVerifyHandler
} from '../../src/handlers/magicLink.ts'
import type { RequestEventLike } from '../../src/types/auth.ts'

type MagicLinkTokenRecord = {
	id?: string
	userId: string | null
	email: string
	tokenHash: string
	otpHash?: string | null
	expiresAt: Date
	metadata?: Record<string, unknown>
}

function createEvent({
	method = 'POST',
	body,
	url = 'http://localhost/auth',
	cookieStore = new Map<string, string>()
}: {
	method?: string
	body?: unknown
	url?: string
	cookieStore?: Map<string, string>
} = {}) {
	const headers = new Headers()
	let requestBody = body
	if (body && typeof body !== 'string') {
		headers.set('content-type', 'application/json')
		requestBody = JSON.stringify(body)
	}
	return {
		request: new Request(url, {
			method,
			body: (requestBody ?? null) as BodyInit | null,
			headers
		}),
		cookies: {
			get: vi.fn((name: string) => cookieStore.get(name)),
			set: vi.fn((name: string, value: string) => cookieStore.set(name, value)),
			delete: vi.fn((name: string) => cookieStore.delete(name))
		},
		locals: {},
		url: new URL(url)
	}
}

function createMagicLinkAdapter() {
	const tokens = new Map<string, MagicLinkTokenRecord>()
	let counter = 0
	const findByTokenHash = async (tokenHash: string) => {
		for (const token of tokens.values()) {
			if (token.tokenHash === tokenHash) return token
		}
		return null
	}
	const findByEmailAndOtpHash = async ({ email, otpHash }: { email: string; otpHash: string }) => {
		for (const token of tokens.values()) {
			if (token.email === email && token.otpHash === otpHash) return token
		}
		return null
	}
	const deleteById = async (id: string) => tokens.delete(id)
	return {
		createToken: async (token: Omit<MagicLinkTokenRecord, 'id'>) => {
			const id = `t${++counter}`
			tokens.set(id, { id, ...token })
			return tokens.get(id)
		},
		findByTokenHash,
		findByEmailAndOtpHash,
		deleteById,
		deleteByEmail: async (email: string) => {
			for (const [id, token] of tokens.entries()) {
				if (token.email === email) tokens.delete(id)
			}
		},
		deleteByUserId: async (userId: string) => {
			for (const [id, token] of tokens.entries()) {
				if (token.userId === userId) tokens.delete(id)
			}
		},
		consumeByTokenHash: async (tokenHash: string) => {
			const record = await findByTokenHash(tokenHash)
			if (record?.id) tokens.delete(record.id)
			return record
		},
		consumeByEmailAndOtpHash: async (params: { email: string; otpHash: string }) => {
			const record = await findByEmailAndOtpHash(params)
			if (record?.id) tokens.delete(record.id)
			return record
		},
		_tokens: tokens
	}
}

describe('magic link handlers', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it('does not send email when user is missing and signup disabled', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const sendEmail = vi.fn()
		const handler = createMagicLinkRequestHandler({
			magicLinkAdapter,
			sendEmail,
			allowSignup: false
		})

		const event = createEvent({ body: { email: 'missing@example.com' } })
		const response = await handler(event as RequestEventLike)
		const payload = await response.json()

		expect(payload.ok).toBe(true)
		expect(sendEmail).not.toHaveBeenCalled()
		expect(magicLinkAdapter._tokens.size).toBe(0)
	})

	it('deletes a newly issued token when delivery fails', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const handler = createMagicLinkRequestHandler({
			magicLinkAdapter,
			userAdapter: {
				getUserByEmail: vi.fn(async (email) => ({ id: 'u1', email }))
			},
			sendEmail: vi.fn(async () => {
				throw new Error('delivery failed')
			})
		})

		await expect(
			handler(createEvent({ body: { email: 'u1@example.com' } }) as RequestEventLike)
		).rejects.toThrow('delivery failed')
		expect(magicLinkAdapter._tokens.size).toBe(0)
	})

	it('forbids raw token exposure in production', () => {
		vi.stubEnv('NODE_ENV', 'production')
		expect(() =>
			createMagicLinkRequestHandler({
				magicLinkAdapter: createMagicLinkAdapter(),
				sendEmail: vi.fn(),
				exposeToken: true
			})
		).toThrow('forbidden in production')
	})

	it('verifies token and creates session', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const sendEmail = vi.fn()
		const userAdapter = {
			getUserByEmail: vi.fn(async (email) => ({ id: 'u1', email })),
			getUserById: vi.fn(async (id) => ({ id, email: 'u1@example.com' })),
			updateUser: vi.fn(async () => {})
		}
		const sessionAdapter = {
			createSession: vi.fn(async (userId) => ({ id: 's1', userId })),
			setSessionCookie: vi.fn()
		}

		const requestHandler = createMagicLinkRequestHandler({
			magicLinkAdapter,
			userAdapter,
			sendEmail,
			exposeToken: true
		})

		const requestEvent = createEvent({ body: { email: 'u1@example.com' } })
		const requestResponse = await requestHandler(requestEvent as RequestEventLike)
		const { token } = await requestResponse.json()

		const verifyHandler = createMagicLinkVerifyHandler({
			magicLinkAdapter,
			userAdapter,
			sessionAdapter,
			requireUserConfirmation: false
		})

		const verifyEvent = createEvent({ body: { token } })
		const verifyResponse = await verifyHandler(verifyEvent as RequestEventLike)
		const payload = await verifyResponse.json()

		expect(payload.ok).toBe(true)
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u1')
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled()
	})

	it('does not create a session when verified-email persistence fails', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const requestHandler = createMagicLinkRequestHandler({
			magicLinkAdapter,
			userAdapter: {
				getUserByEmail: vi.fn(async (email) => ({ id: 'u1', email, emailVerified: false }))
			},
			sendEmail: vi.fn(),
			exposeToken: true
		})
		const requestResponse = await requestHandler(
			createEvent({ body: { email: 'u1@example.com' } }) as RequestEventLike
		)
		const { token } = await requestResponse.json()
		const sessionAdapter = {
			createSession: vi.fn(),
			setSessionCookie: vi.fn()
		}
		const verifyHandler = createMagicLinkVerifyHandler({
			magicLinkAdapter,
			userAdapter: {
				getUserByEmail: vi.fn(async (email) => ({ id: 'u1', email, emailVerified: false })),
				getUserById: vi.fn(async (id) => ({
					id,
					email: 'u1@example.com',
					emailVerified: false
				})),
				updateUser: vi.fn(async () => {
					throw new Error('database unavailable')
				}),
				createUser: vi.fn()
			},
			sessionAdapter,
			requireUserConfirmation: false
		})

		await expect(
			verifyHandler(createEvent({ body: { token } }) as RequestEventLike)
		).rejects.toThrow('database unavailable')
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
	})

	it('creates a session when onLogin returns a userId', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const sendEmail = vi.fn()
		const sessionAdapter = {
			createSession: vi.fn(async (userId: string) => ({ id: 's2', userId })),
			setSessionCookie: vi.fn()
		}

		const requestHandler = createMagicLinkRequestHandler({
			magicLinkAdapter,
			sendEmail,
			allowSignup: true,
			exposeToken: true
		})

		const requestResponse = await requestHandler(
			createEvent({ body: { email: 'hook@example.com' } }) as RequestEventLike
		)
		const { token } = await requestResponse.json()

		const verifyHandler = createMagicLinkVerifyHandler({
			magicLinkAdapter,
			sessionAdapter,
			onLogin: async () => ({ userId: 'hook-user' }),
			requireUserConfirmation: false
		})

		const verifyResponse = await verifyHandler(createEvent({ body: { token } }) as RequestEventLike)
		const payload = await verifyResponse.json()

		expect(payload.ok).toBe(true)
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('hook-user')
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled()
	})

	it('rejects verification when no principal can be resolved', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const sendEmail = vi.fn()
		const sessionAdapter = {
			createSession: vi.fn(async (userId: string) => ({ id: 's3', userId })),
			setSessionCookie: vi.fn()
		}

		const requestHandler = createMagicLinkRequestHandler({
			magicLinkAdapter,
			sendEmail,
			allowSignup: true,
			exposeToken: true
		})

		const requestResponse = await requestHandler(
			createEvent({ body: { email: 'missing@example.com' } }) as RequestEventLike
		)
		const { token } = await requestResponse.json()

		const verifyHandler = createMagicLinkVerifyHandler({
			magicLinkAdapter,
			sessionAdapter,
			onLogin: async () => undefined,
			requireUserConfirmation: false
		})

		const verifyResponse = await verifyHandler(createEvent({ body: { token } }) as RequestEventLike)
		const payload = await verifyResponse.json()

		expect(verifyResponse.status).toBe(401)
		expect(payload.ok).toBe(false)
		expect(payload.error).toContain('Unable to resolve authenticated principal')
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
	})

	it('does not consume a GET link until its browser confirmation is posted', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const sendEmail = vi.fn()
		const userAdapter = {
			getUserByEmail: vi.fn(async (email) => ({ id: 'u1', email })),
			getUserById: vi.fn(async (id) => ({ id, email: 'u1@example.com' })),
			updateUser: vi.fn(async () => {})
		}
		const sessionAdapter = {
			createSession: vi.fn(async (userId) => ({ id: 's1', userId })),
			setSessionCookie: vi.fn()
		}

		const requestHandler = createMagicLinkRequestHandler({
			magicLinkAdapter,
			userAdapter,
			sendEmail,
			exposeToken: true
		})

		const requestResponse = await requestHandler(
			createEvent({
				body: { email: 'u1@example.com', redirectTo: '/dashboard' }
			}) as RequestEventLike
		)
		const { token } = await requestResponse.json()

		const verifyHandler = createMagicLinkVerifyHandler({
			magicLinkAdapter,
			userAdapter,
			sessionAdapter,
			redirectAfterLogin: '/fallback'
		})
		const cookieStore = new Map([['csrf-token', 'csrf-value']])
		const getResponse = await verifyHandler(
			createEvent({
				method: 'GET',
				url: `http://localhost/auth/magic?token=${token}&redirectTo=%2Fdashboard`,
				cookieStore
			}) as RequestEventLike
		)
		const html = await getResponse.text()
		const confirmation = /name="confirmation" value="([^"]+)"/.exec(html)?.[1] ?? ''

		expect(getResponse.status).toBe(200)
		expect(getResponse.headers.get('cache-control')).toContain('no-store')
		expect(confirmation).not.toBe('')
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
		expect(magicLinkAdapter._tokens.size).toBe(1)

		const postResponse = await verifyHandler(
			createEvent({
				body: { token, redirectTo: '/dashboard', confirmation },
				url: 'http://localhost/auth/magic',
				cookieStore
			}) as RequestEventLike
		)
		expect(await postResponse.json()).toMatchObject({ ok: true })
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u1')
		expect(magicLinkAdapter._tokens.size).toBe(0)
	})
})
