import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	createMagicLinkRequestHandler,
	createMagicLinkVerifyHandler
} from '../../src/handlers/magicLink.ts'
import type { RequestEventLike } from '../../src/types/auth.ts'
import { createMfaLoginTestConfig } from '../testKit.ts'

const MAGIC_LINK_BASE_URL = 'https://auth.example.test'
const OTP_PEPPER = 'test-only-magic-link-pepper-32-bytes-minimum'

function createTestMagicLinkRequestHandler(
	config: Omit<Parameters<typeof createMagicLinkRequestHandler>[0], 'baseUrl' | 'otpPepper'> & {
		baseUrl?: string
		otpPepper?: string | Uint8Array
	}
) {
	return createMagicLinkRequestHandler({
		baseUrl: MAGIC_LINK_BASE_URL,
		otpPepper: OTP_PEPPER,
		...config
	})
}

function createTestMagicLinkVerifyHandler(
	config: Omit<
		Parameters<typeof createMagicLinkVerifyHandler>[0],
		'otpPepper' | 'verifyRateLimit'
	> & {
		otpPepper?: string | Uint8Array
		verifyRateLimit?: (key: string) => Promise<{ allowed: boolean }>
	}
) {
	return createMagicLinkVerifyHandler({
		otpPepper: OTP_PEPPER,
		verifyRateLimit: async () => ({ allowed: true }),
		...config
	})
}

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
		const handler = createTestMagicLinkRequestHandler({
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
		const handler = createTestMagicLinkRequestHandler({
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

	it('requires a canonical HTTPS origin and sufficiently strong OTP pepper', () => {
		const base = { magicLinkAdapter: createMagicLinkAdapter(), sendEmail: vi.fn() }
		expect(() =>
			createMagicLinkRequestHandler({ ...base, baseUrl: 'http://example.test' })
		).toThrow('HTTPS origin')
		expect(() => createMagicLinkRequestHandler({ ...base, baseUrl: MAGIC_LINK_BASE_URL })).toThrow(
			'requires otpPepper'
		)
		expect(() =>
			createMagicLinkRequestHandler({
				...base,
				baseUrl: MAGIC_LINK_BASE_URL,
				otpPepper: 'too-short'
			})
		).toThrow('at least 32 bytes')
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

		const requestHandler = createTestMagicLinkRequestHandler({
			magicLinkAdapter,
			userAdapter,
			sendEmail
		})

		const requestEvent = createEvent({ body: { email: 'u1@example.com' } })
		const requestResponse = await requestHandler(requestEvent as RequestEventLike)
		expect(await requestResponse.json()).toEqual({ ok: true })
		const token = sendEmail.mock.calls[0]?.[0].token

		const verifyHandler = createTestMagicLinkVerifyHandler({
			magicLinkAdapter,
			userAdapter,
			sessionAdapter,
			getSessionMetadata: vi.fn(async () => ({ fingerprint: 'fingerprint-1' })),
			requireUserConfirmation: false
		})

		const verifyEvent = createEvent({ body: { token } })
		const verifyResponse = await verifyHandler(verifyEvent as RequestEventLike)
		const payload = await verifyResponse.json()

		expect(payload.ok).toBe(true)
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u1', {
			fingerprint: 'fingerprint-1'
		})
		expect(sessionAdapter.setSessionCookie).toHaveBeenCalled()
	})

	it('HMACs OTPs, keeps credentials out of responses, and binds verification to the pepper', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const sendEmail = vi.fn()
		const userAdapter = {
			getUserByEmail: vi.fn(async (email: string) => ({ id: 'u1', email })),
			getUserById: vi.fn(async (id: string) => ({ id, email: 'u1@example.com' })),
			updateUser: vi.fn(async () => {})
		}
		const sessionAdapter = {
			createSession: vi.fn(async (userId: string) => ({ id: 's1', userId })),
			setSessionCookie: vi.fn()
		}
		const requestHandler = createTestMagicLinkRequestHandler({
			magicLinkAdapter,
			userAdapter,
			sendEmail
		})

		const requestResponse = await requestHandler(
			createEvent({ body: { email: 'u1@example.com' } }) as RequestEventLike
		)
		const responseText = await requestResponse.text()
		const delivery = sendEmail.mock.calls[0]?.[0]
		const stored = [...magicLinkAdapter._tokens.values()][0]
		expect(responseText).toBe('{"ok":true}')
		expect(responseText).not.toContain(delivery.token)
		expect(responseText).not.toContain(delivery.otp)
		expect(stored?.otpHash).not.toBe(delivery.otp)
		expect(stored?.otpHash).toMatch(/^[A-Za-z0-9_-]+$/)

		const wrongPepperHandler = createTestMagicLinkVerifyHandler({
			magicLinkAdapter,
			userAdapter,
			sessionAdapter,
			otpPepper: 'different-test-pepper-that-is-at-least-32-bytes'
		})
		const wrongResponse = await wrongPepperHandler(
			createEvent({ body: { email: delivery.email, otp: delivery.otp } }) as RequestEventLike
		)
		expect(wrongResponse.status).toBe(400)
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()

		const verifyHandler = createTestMagicLinkVerifyHandler({
			magicLinkAdapter,
			userAdapter,
			sessionAdapter,
			requireUserConfirmation: false
		})
		const verifyResponse = await verifyHandler(
			createEvent({ body: { email: delivery.email, otp: delivery.otp } }) as RequestEventLike
		)
		expect(await verifyResponse.json()).toMatchObject({ ok: true })
		expect(sessionAdapter.createSession).toHaveBeenCalledWith('u1')
	})

	it('does not create a session when verified-email persistence fails', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const sendEmail = vi.fn()
		const requestHandler = createTestMagicLinkRequestHandler({
			magicLinkAdapter,
			userAdapter: {
				getUserByEmail: vi.fn(async (email) => ({ id: 'u1', email, emailVerified: false }))
			},
			sendEmail
		})
		const requestResponse = await requestHandler(
			createEvent({ body: { email: 'u1@example.com' } }) as RequestEventLike
		)
		expect(await requestResponse.json()).toEqual({ ok: true })
		const token = sendEmail.mock.calls[0]?.[0].token
		const sessionAdapter = {
			createSession: vi.fn(),
			setSessionCookie: vi.fn()
		}
		const verifyHandler = createTestMagicLinkVerifyHandler({
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

	it('creates a session when the authentication lifecycle returns a userId', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const sendEmail = vi.fn()
		const sessionAdapter = {
			createSession: vi.fn(async (userId: string) => ({ id: 's2', userId })),
			setSessionCookie: vi.fn()
		}

		const requestHandler = createTestMagicLinkRequestHandler({
			magicLinkAdapter,
			sendEmail,
			allowSignup: true
		})

		const requestResponse = await requestHandler(
			createEvent({ body: { email: 'hook@example.com' } }) as RequestEventLike
		)
		expect(await requestResponse.json()).toEqual({ ok: true })
		const token = sendEmail.mock.calls[0]?.[0].token

		const onAuthentication = vi.fn(async () => ({ userId: 'hook-user' }))
		const beforeSessionCreate = vi.fn()
		const verifyHandler = createTestMagicLinkVerifyHandler({
			magicLinkAdapter,
			sessionAdapter,
			onAuthentication,
			beforeSessionCreate,
			requireUserConfirmation: false
		})

		const verifyResponse = await verifyHandler(createEvent({ body: { token } }) as RequestEventLike)
		const payload = await verifyResponse.json()

		expect(payload.ok).toBe(true)
		expect(onAuthentication).toHaveBeenCalledWith(
			expect.objectContaining({
				method: { kind: 'magic-link', email: 'hook@example.com' },
				user: null
			})
		)
		expect(beforeSessionCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				method: { kind: 'magic-link', email: 'hook@example.com' },
				user: null
			})
		)
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

		const requestHandler = createTestMagicLinkRequestHandler({
			magicLinkAdapter,
			sendEmail,
			allowSignup: true
		})

		const requestResponse = await requestHandler(
			createEvent({ body: { email: 'missing@example.com' } }) as RequestEventLike
		)
		expect(await requestResponse.json()).toEqual({ ok: true })
		const token = sendEmail.mock.calls[0]?.[0].token

		const verifyHandler = createTestMagicLinkVerifyHandler({
			magicLinkAdapter,
			sessionAdapter,
			onAuthentication: async () => undefined,
			requireUserConfirmation: false
		})

		const verifyResponse = await verifyHandler(createEvent({ body: { token } }) as RequestEventLike)
		const payload = await verifyResponse.json()

		expect(verifyResponse.status).toBe(401)
		expect(payload.ok).toBe(false)
		expect(payload.error).toContain('Unable to resolve authenticated principal')
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
	})

	it('defers magic-link session creation when the user has MFA enabled', async () => {
		const magicLinkAdapter = createMagicLinkAdapter()
		const sendEmail = vi.fn()
		const user = {
			id: 'mfa-user',
			email: 'mfa@example.com',
			name: 'MFA User',
			avatar: null,
			emailVerified: true
		}
		const userAdapter = {
			getUserByEmail: vi.fn(async () => user),
			getUserById: vi.fn(async () => user),
			createUser: vi.fn(),
			updateUser: vi.fn()
		}
		const sessionAdapter = {
			createSession: vi.fn(async (userId: string) => ({ id: 's-mfa', userId })),
			setSessionCookie: vi.fn()
		}
		const { config: mfa, replaceForUserAndType } = createMfaLoginTestConfig()
		const beforeSessionCreate = vi.fn()
		const requestHandler = createTestMagicLinkRequestHandler({
			magicLinkAdapter,
			userAdapter,
			sendEmail
		})

		await requestHandler(
			createEvent({ body: { email: user.email, redirectTo: '/library' } }) as RequestEventLike
		)
		const token = sendEmail.mock.calls[0]?.[0].token
		const verifyHandler = createTestMagicLinkVerifyHandler({
			magicLinkAdapter,
			userAdapter,
			sessionAdapter,
			requireUserConfirmation: false,
			beforeSessionCreate,
			mfa
		})

		const response = await verifyHandler(
			createEvent({ body: { token, redirectTo: '/library' } }) as RequestEventLike
		)

		expect(await response.json()).toEqual({ ok: true, twoFactorRequired: true })
		expect(sessionAdapter.createSession).not.toHaveBeenCalled()
		expect(beforeSessionCreate).not.toHaveBeenCalled()
		expect(replaceForUserAndType).toHaveBeenCalledWith(
			expect.objectContaining({ metadata: { redirectTo: '/library' } })
		)
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

		const requestHandler = createTestMagicLinkRequestHandler({
			magicLinkAdapter,
			userAdapter,
			sendEmail
		})

		const requestResponse = await requestHandler(
			createEvent({
				body: { email: 'u1@example.com', redirectTo: '/dashboard' }
			}) as RequestEventLike
		)
		expect(await requestResponse.json()).toEqual({ ok: true })
		const token = sendEmail.mock.calls[0]?.[0].token

		const verifyHandler = createTestMagicLinkVerifyHandler({
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
