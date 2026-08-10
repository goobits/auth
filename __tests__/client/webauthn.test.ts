import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	createAuthClient,
	supportsConditionalPasskeys,
	supportsPasskeys
} from '../../src/client/index.ts'
import { createQueuedFetcher } from './_testKit.ts'

describe('auth client WebAuthn', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('reports passkey support only when the complete browser boundary exists', () => {
		expect(supportsPasskeys()).toBe(false)

		vi.stubGlobal('PublicKeyCredential', class {})
		vi.stubGlobal('navigator', { credentials: {} })
		expect(supportsPasskeys()).toBe(true)
	})

	it('reports conditional passkey support only when the browser confirms it', async () => {
		expect(await supportsConditionalPasskeys()).toBe(false)

		const isConditionalMediationAvailable = vi.fn(async () => true)
		vi.stubGlobal(
			'PublicKeyCredential',
			class {
				static isConditionalMediationAvailable = isConditionalMediationAvailable
			}
		)
		vi.stubGlobal('navigator', { credentials: {} })

		await expect(supportsConditionalPasskeys()).resolves.toBe(true)
		expect(isConditionalMediationAvailable).toHaveBeenCalledOnce()
	})

	it('converts WebAuthn options and credentials at the browser boundary', async () => {
		const createCredential = vi.fn(async () => ({
			id: 'register-credential',
			type: 'public-key',
			rawId: new Uint8Array([7, 8]),
			response: {
				attestationObject: new Uint8Array([9]),
				clientDataJSON: new Uint8Array([10]),
				getTransports: () => ['internal']
			}
		}))
		const getCredential = vi.fn(async () => ({
			id: 'login-credential',
			type: 'public-key',
			rawId: new Uint8Array([14]),
			response: {
				authenticatorData: new Uint8Array([11]),
				clientDataJSON: new Uint8Array([10]),
				signature: new Uint8Array([12]),
				userHandle: new Uint8Array([13])
			}
		}))
		vi.stubGlobal('PublicKeyCredential', class {})
		vi.stubGlobal('navigator', {
			credentials: { create: createCredential, get: getCredential }
		})
		const fetcher = createQueuedFetcher([
			{
				challengeId: 'register-challenge',
				options: {
					challenge: 'AQI',
					user: { id: 'AwQ', name: 'member@example.com', displayName: 'Member' },
					excludeCredentials: [{ id: 'BQY', type: 'public-key' }]
				}
			},
			{ ok: true },
			{
				challengeId: 'login-challenge',
				options: {
					challenge: 'Dw',
					allowCredentials: [{ id: 'EBE', type: 'public-key' }]
				}
			},
			{ ok: true }
		])
		const client = createAuthClient({ fetcher })

		await expect(client.registerPasskey({ name: 'Example app key' })).resolves.toEqual({
			success: true
		})
		await expect(client.loginWithPasskey()).resolves.toEqual({ success: true })

		const createOptions = createCredential.mock.calls[0]?.[0]?.publicKey
		expect(Array.from(createOptions?.challenge as Uint8Array)).toEqual([1, 2])
		expect(Array.from(createOptions?.user.id as Uint8Array)).toEqual([3, 4])
		expect(Array.from(createOptions?.excludeCredentials?.[0]?.id as Uint8Array)).toEqual([5, 6])
		const requestOptions = getCredential.mock.calls[0]?.[0]?.publicKey
		expect(Array.from(requestOptions?.challenge as Uint8Array)).toEqual([15])
		expect(Array.from(requestOptions?.allowCredentials?.[0]?.id as Uint8Array)).toEqual([16, 17])

		const registerBody = JSON.parse(String(vi.mocked(fetcher).mock.calls[1]?.[1]?.body)) as Record<
			string,
			unknown
		>
		expect(registerBody).toEqual({
			challengeId: 'register-challenge',
			credential: {
				id: 'register-credential',
				type: 'public-key',
				rawId: 'Bwg',
				response: {
					attestationObject: 'CQ',
					clientDataJSON: 'Cg',
					transports: ['internal']
				}
			},
			name: 'Example app key'
		})
		const loginBody = JSON.parse(String(vi.mocked(fetcher).mock.calls[3]?.[1]?.body)) as Record<
			string,
			unknown
		>
		expect(loginBody).toEqual({
			challengeId: 'login-challenge',
			credential: {
				id: 'login-credential',
				type: 'public-key',
				rawId: 'Dg',
				response: {
					authenticatorData: 'Cw',
					clientDataJSON: 'Cg',
					signature: 'DA',
					userHandle: 'DQ'
				}
			}
		})
		expect(vi.mocked(fetcher).mock.calls[2]?.[1]?.body).toBeUndefined()
	})

	it('returns passkey option failures without opening a browser ceremony', async () => {
		const createCredential = vi.fn()
		const getCredential = vi.fn()
		vi.stubGlobal('PublicKeyCredential', class {})
		vi.stubGlobal('navigator', {
			credentials: { create: createCredential, get: getCredential }
		})
		const client = createAuthClient({
			fetcher: createQueuedFetcher([
				{ ok: false, error: 'Reauthentication required' },
				{ ok: false, error: 'Passkey login unavailable' }
			])
		})

		await expect(client.registerPasskey({ currentPassword: 'wrong-password' })).resolves.toEqual({
			success: false,
			error: 'Reauthentication required'
		})
		await expect(client.loginWithPasskey()).resolves.toEqual({
			success: false,
			error: 'Passkey login unavailable'
		})
		expect(createCredential).not.toHaveBeenCalled()
		expect(getCredential).not.toHaveBeenCalled()
	})

	it('requests conditional mediation for passkey autofill when supported', async () => {
		const getCredential = vi.fn(async () => ({
			id: 'conditional-credential',
			type: 'public-key',
			rawId: new Uint8Array([1]),
			response: {
				authenticatorData: new Uint8Array([2]),
				clientDataJSON: new Uint8Array([3]),
				signature: new Uint8Array([4]),
				userHandle: null
			}
		}))
		vi.stubGlobal(
			'PublicKeyCredential',
			class {
				static isConditionalMediationAvailable = vi.fn(async () => true)
			}
		)
		vi.stubGlobal('navigator', { credentials: { get: getCredential } })
		const controller = new AbortController()
		const client = createAuthClient({
			fetcher: createQueuedFetcher([
				{
					challengeId: 'conditional-challenge',
					options: { challenge: 'AQ' }
				},
				{ ok: true }
			])
		})

		await expect(
			client.loginWithPasskey({ conditional: true, signal: controller.signal })
		).resolves.toEqual({ success: true })
		expect(getCredential).toHaveBeenCalledWith(
			expect.objectContaining({
				mediation: 'conditional',
				signal: controller.signal,
				publicKey: expect.objectContaining({ challenge: expect.any(Uint8Array) })
			})
		)
	})

	it('lists and removes passkeys through the owner-scoped management endpoint', async () => {
		const fetcher = createQueuedFetcher([
			{
				ok: true,
				credentials: [
					{
						credentialId: 'credential-1',
						name: 'Laptop',
						transports: ['internal'],
						createdAt: '2026-07-27T00:00:00.000Z',
						lastUsedAt: null
					}
				]
			},
			{ ok: true }
		])
		const client = createAuthClient({ fetcher })

		await expect(client.listPasskeys()).resolves.toEqual({
			success: true,
			credentials: [
				{
					credentialId: 'credential-1',
					name: 'Laptop',
					transports: ['internal'],
					createdAt: '2026-07-27T00:00:00.000Z',
					lastUsedAt: null
				}
			]
		})
		await expect(
			client.removePasskey({
				credentialId: 'credential-1',
				currentPassword: 'current-password'
			})
		).resolves.toEqual({ success: true })

		expect(vi.mocked(fetcher).mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual(
			[
				['/auth/passkey/credentials', 'GET'],
				['/auth/passkey/credentials', 'POST']
			]
		)
		expect(
			Object.fromEntries((vi.mocked(fetcher).mock.calls[1]?.[1]?.body as FormData).entries())
		).toEqual({
			credentialId: 'credential-1',
			currentPassword: 'current-password'
		})
	})

	it('uses a browser passkey for session step-up', async () => {
		const getCredential = vi.fn(async () => ({
			id: 'step-up-credential',
			type: 'public-key',
			rawId: new Uint8Array([1]),
			response: {
				authenticatorData: new Uint8Array([2]),
				clientDataJSON: new Uint8Array([3]),
				signature: new Uint8Array([4]),
				userHandle: new Uint8Array([5])
			}
		}))
		vi.stubGlobal('PublicKeyCredential', class {})
		vi.stubGlobal('navigator', { credentials: { get: getCredential } })
		const fetcher = createQueuedFetcher([
			{ challengeId: 'step-up-challenge', options: { challenge: 'AQ' } },
			{ ok: true, mfaVerifiedAt: '2026-07-27T00:01:00.000Z' }
		])
		const client = createAuthClient({ fetcher })

		await expect(client.stepUpWithPasskey()).resolves.toEqual({
			success: true,
			mfaVerifiedAt: '2026-07-27T00:01:00.000Z'
		})
		expect(vi.mocked(fetcher).mock.calls.map(([url]) => String(url))).toEqual([
			'/auth/passkey/step-up/options',
			'/auth/passkey/step-up/verify'
		])
	})
})
