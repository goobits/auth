import { vi } from 'vitest'

import { createMagicLinkRequestHandler } from '../../src/handlers/magicLinkRequest.ts'
import { createMagicLinkVerifyHandler } from '../../src/handlers/magicLinkVerification.ts'

export const MAGIC_LINK_BASE_URL = 'https://auth.example.test'
const OTP_PEPPER = 'test-only-magic-link-pepper-32-bytes-minimum'

export function createTestMagicLinkRequestHandler(
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

export function createTestMagicLinkVerifyHandler(
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

export function createMagicLinkPrincipalAdapters() {
	const userAdapter = {
		getUserByEmail: vi.fn(async (email: string) => ({ id: 'u1', email })),
		getUserById: vi.fn(async (id: string) => ({ id, email: 'u1@example.com' })),
		updateUser: vi.fn(async () => {})
	}
	const sessionAdapter = {
		createSession: vi.fn(async (userId: string) => ({ id: 's1', userId })),
		setSessionCookie: vi.fn()
	}
	return { sessionAdapter, userAdapter }
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

export function createMagicLinkEvent({
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

export function createMagicLinkAdapter() {
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
