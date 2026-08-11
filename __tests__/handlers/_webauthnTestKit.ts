import { vi } from 'vitest'

import { MemoryWebAuthnAdapter } from '../../src/adapters/memory/webauthn.ts'
import type { RequestEventLike } from '../../src/types/auth.ts'
import type { AuthSession } from '../../src/types/core.ts'

export const TEST_USER = {
	id: 'u1',
	email: 'u1@example.com',
	name: 'User',
	avatar: null,
	emailVerified: true
}

export function createWebAuthnAdapter(): MemoryWebAuthnAdapter {
	return new MemoryWebAuthnAdapter()
}

export function createEvent({
	method = 'POST',
	body,
	user = TEST_USER,
	session = {
		id: 'session-1',
		userId: user?.id ?? 'u1',
		expiresAt: new Date(Date.now() + 60_000),
		createdAt: new Date()
	},
	path = '/'
}: {
	method?: string
	body?: unknown
	user?: typeof TEST_USER | null
	session?: AuthSession | null
	path?: string
} = {}): RequestEventLike {
	const headers = new Headers()
	let requestBody: BodyInit | null = null
	if (body instanceof FormData) {
		requestBody = body
	} else if (body !== undefined) {
		headers.set('content-type', 'application/json')
		requestBody = JSON.stringify(body)
	}
	const values = new Map<string, string>()
	return {
		request: new Request(`http://localhost${path}`, { method, body: requestBody, headers }),
		cookies: {
			get: (name: string) => values.get(name),
			set: vi.fn((name: string, value: string) => values.set(name, value)),
			delete: vi.fn((name: string) => values.delete(name))
		},
		locals: { user, session },
		url: new URL(`http://localhost${path}`)
	}
}

export async function addCredential(
	adapter: MemoryWebAuthnAdapter,
	{
		userId = 'u1',
		credentialId = 'AQIDBAcI',
		counter = 0,
		name = 'Laptop'
	}: {
		userId?: string
		credentialId?: string
		counter?: number
		name?: string
	} = {}
) {
	await adapter.createCredential({
		userId,
		credentialId,
		publicKey: 'AQID',
		counter,
		transports: ['internal'],
		name
	})
}
