import { vi } from 'vitest'

import type { MfaLoginConfig } from '../src/handlers/mfa.ts'
import type { RequestEventLike } from '../src/types/auth.ts'

export const TEST_CSRF_SECRET = 'auth-test-csrf-secret-that-is-at-least-32-bytes'

type CookieOptions = Record<string, unknown>

export function createCookies(initial: Record<string, string> = {}) {
	const store = new Map<string, { value: string; options: CookieOptions }>()

	for (const [name, value] of Object.entries(initial)) {
		store.set(name, { value, options: {} })
	}

	return {
		get: (name: string) => store.get(name)?.value ?? null,
		set: (name: string, value: string, options: CookieOptions = {}) =>
			store.set(name, { value, options }),
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

/** Builds the shared enabled-MFA fixture used by login lifecycle tests. */
export function createMfaLoginTestConfig(options: { challengeRedirect?: string } = {}) {
	const store = {
		activateEnrollment: vi.fn(async () => true),
		beginEnrollment: vi.fn(async () => true),
		consumeBackupCode: vi.fn(async () => true),
		disableMfa: vi.fn(async () => true),
		getBackupCodes: vi.fn(async () => []),
		getSecret: vi.fn(async () => 'SECRET'),
		getStatus: vi.fn(async () => ({
			enabled: true,
			enabledAt: new Date(),
			backupCodeCount: 8
		}))
	}
	const replaceForUserAndType = vi.fn(async () => undefined)
	const verificationTokenAdapter = {
		replaceForUserAndType,
		create: vi.fn(async () => undefined),
		findByToken: vi.fn(async () => null),
		deleteById: vi.fn(async () => undefined),
		deleteByUserAndType: vi.fn(async () => undefined),
		consumeByToken: vi.fn(async () => null)
	}
	const config: MfaLoginConfig = {
		store,
		verificationTokenAdapter: verificationTokenAdapter as never,
		challengeRedirect: options.challengeRedirect ?? '/login?mfa=required',
		secureCookies: false
	}
	return { config, replaceForUserAndType, store, verificationTokenAdapter }
}
