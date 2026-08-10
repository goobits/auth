import type {
	AuthClientFailure,
	AuthSessionSummary,
	MfaActionResult,
	PasskeyCredentialSummary,
	PasskeyOptionsResult
} from './_types.ts'

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function readJsonRecord(response: Response): Promise<Record<string, unknown>> {
	const value: unknown = await response.json()
	if (!isRecord(value)) throw new Error('Invalid authentication response')
	return value
}

export function parseFailure(value: Record<string, unknown>): AuthClientFailure {
	const result: AuthClientFailure = {
		success: false,
		error: typeof value['error'] === 'string' ? value['error'] : 'Authentication request failed'
	}
	if (typeof value['code'] === 'string') result.code = value['code']
	if (typeof value['status'] === 'number') result.status = value['status']
	return result
}

export function requireSuccessFlag(value: Record<string, unknown>): boolean {
	if (typeof value['success'] !== 'boolean') throw new Error('Invalid authentication response')
	return value['success']
}

export function parseMfaAction(value: Record<string, unknown>): MfaActionResult {
	if (!requireSuccessFlag(value)) return parseFailure(value)
	const verifiedAt = value['mfaVerifiedAt']
	if (verifiedAt !== undefined && typeof verifiedAt !== 'string') {
		throw new Error('Invalid authentication response')
	}
	return verifiedAt ? { success: true, mfaVerifiedAt: verifiedAt } : { success: true }
}

export function parsePasskeyCredential(value: unknown): PasskeyCredentialSummary {
	if (!isRecord(value)) throw new Error('Invalid authentication response')
	const credentialId = value['credentialId']
	const name = value['name']
	const transports = value['transports']
	const createdAt = value['createdAt']
	const lastUsedAt = value['lastUsedAt']
	if (
		typeof credentialId !== 'string' ||
		(name !== null && typeof name !== 'string') ||
		(transports !== null &&
			(!Array.isArray(transports) ||
				!transports.every((transport) => typeof transport === 'string'))) ||
		(createdAt !== null && typeof createdAt !== 'string') ||
		(lastUsedAt !== null && typeof lastUsedAt !== 'string')
	) {
		throw new Error('Invalid authentication response')
	}
	return { credentialId, name, transports, createdAt, lastUsedAt }
}

export function parsePasskeyAction(value: Record<string, unknown>): MfaActionResult {
	if (value['ok'] === false) {
		return {
			success: false,
			error: typeof value['error'] === 'string' ? value['error'] : 'Authentication request failed'
		}
	}
	if (value['ok'] !== true) throw new Error('Invalid authentication response')
	const verifiedAt = value['mfaVerifiedAt']
	if (verifiedAt !== undefined && typeof verifiedAt !== 'string') {
		throw new Error('Invalid authentication response')
	}
	return verifiedAt ? { success: true, mfaVerifiedAt: verifiedAt } : { success: true }
}

export function parsePasskeyOptions(value: Record<string, unknown>): PasskeyOptionsResult {
	if (value['ok'] === false || value['success'] === false) return parseFailure(value)
	if (!isRecord(value['options']) || typeof value['challengeId'] !== 'string') {
		throw new Error('Invalid authentication response')
	}
	return { success: true, options: value['options'], challengeId: value['challengeId'] }
}

export function parseSessionFailure(value: Record<string, unknown>): { ok: false; error: string } {
	return {
		ok: false,
		error: typeof value['error'] === 'string' ? value['error'] : 'Session request failed'
	}
}

export function parseSessionSummary(value: unknown): AuthSessionSummary {
	if (!isRecord(value)) throw new Error('Invalid authentication response')
	const id = value['id']
	const userId = value['userId']
	const expiresAt = value['expiresAt']
	const createdAt = value['createdAt']
	const lastActiveAt = value['lastActiveAt']
	const ip = value['ip']
	const userAgent = value['userAgent']
	const current = value['current']
	if (
		typeof id !== 'string' ||
		typeof userId !== 'string' ||
		typeof expiresAt !== 'string' ||
		(createdAt !== null && typeof createdAt !== 'string') ||
		(lastActiveAt !== null && typeof lastActiveAt !== 'string') ||
		(ip !== null && typeof ip !== 'string') ||
		(userAgent !== null && typeof userAgent !== 'string') ||
		typeof current !== 'boolean'
	) {
		throw new Error('Invalid authentication response')
	}
	return { id, userId, expiresAt, createdAt, lastActiveAt, ip, userAgent, current }
}
