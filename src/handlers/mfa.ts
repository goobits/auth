import type { VerificationTokenAdapter } from '../adapters/verification-token/VerificationTokenAdapter.ts'
import type { Session, SessionMetadata } from '../types/core.ts'
import { generateBackupCodes, hashBackupCodes, verifyBackupCode } from '../mfa/backupCodes.ts'
import { createOtpAuthURL, generateSecret, verifyTOTP } from '../mfa/totp.ts'
import type { AuthorizeSecurityChange, RequestEventLike } from '../types/auth.ts'
import type { User } from '../types/core.ts'
import {
	consumeVerificationTokenRecord,
	createVerificationToken,
	getVerificationTokenRecord,
	VERIFICATION_TOKEN_TYPES
} from '../verification/index.ts'

const DEFAULT_LOGIN_CHALLENGE_COOKIE = 'goobits_mfa_login'
const DEFAULT_LOGIN_CHALLENGE_TTL_MS = 5 * 60 * 1000

/** Mfa Store typed model for runtime integration. */
export type MfaStore = {
	beginEnrollment: (userId: string, secret: string, backupCodes: string[]) => Promise<boolean>
	activateEnrollment: (userId: string) => Promise<boolean>
	getSecret: (userId: string) => Promise<string | null>
	disableMfa: (userId: string) => Promise<boolean>
	getBackupCodes: (userId: string) => Promise<string[]>
	consumeBackupCode: (userId: string, hash: string) => Promise<boolean>
	getStatus: (userId: string) => Promise<{
		enabled: boolean
		enabledAt: Date | null
		backupCodeCount: number
	}>
}

/** Mfa Config typed model for runtime integration. */
export type MfaConfig = {
	getUserId: (locals: RequestEventLike['locals']) => string | null
	store: MfaStore
	issuer?: string
	label?: (userId: string, locals: RequestEventLike['locals']) => string
}

/** Configuration for MFA operations that change a user's factors. */
type MfaSecurityChangeConfig = MfaConfig & {
	authorizeSecurityChange: AuthorizeSecurityChange
}

type MfaLoginStore = MfaStore & {
	getStatus: NonNullable<MfaStore['getStatus']>
}

/** Configuration shared by credential signin and MFA challenge verification. */
export type MfaLoginConfig = {
	store: MfaLoginStore
	verificationTokenAdapter: VerificationTokenAdapter
	isRequired?: (user: User) => boolean | Promise<boolean>
	challengeCookieName?: string
	challengeExpiresInMs?: number
	secureCookies?: boolean
}

type MfaLoginSessionAdapter = {
	createSession: (userId: string, metadata?: SessionMetadata) => Promise<Session>
	setSessionCookie: (cookies: RequestEventLike['cookies'], session: Session) => void
}

function userIdFromRecord(user: unknown): string | null {
	if (!user || typeof user !== 'object' || Array.isArray(user)) return null
	const id = (user as Record<string, unknown>)['id']
	return typeof id === 'string' || typeof id === 'number' ? String(id) : null
}

function challengeCookieName(config: MfaLoginConfig): string {
	return config.challengeCookieName ?? DEFAULT_LOGIN_CHALLENGE_COOKIE
}

function challengeMetadata(record: Record<string, unknown> | undefined): SessionMetadata {
	if (!record) return {}
	const metadata: SessionMetadata = {}
	if (record['rememberMe'] === true) metadata['rememberMe'] = true
	if (typeof record['ip'] === 'string') metadata['ip'] = record['ip']
	if (typeof record['userAgent'] === 'string') metadata['userAgent'] = record['userAgent']
	if (typeof record['fingerprint'] === 'string') metadata['fingerprint'] = record['fingerprint']
	return metadata
}

/** Starts a short-lived, single-use MFA challenge when the authenticated password requires it. */
export async function beginMfaLoginChallenge({
	event,
	user,
	sessionMetadata,
	config
}: {
	event: RequestEventLike
	user: User
	sessionMetadata: SessionMetadata
	config: MfaLoginConfig
}): Promise<
	| { handled: false }
	| {
			handled: true
			response: {
				success: boolean
				twoFactorRequired?: boolean
				mfaEnrollmentRequired?: boolean
				error?: string
			}
	  }
> {
	const userId = userIdFromRecord(user)
	if (!userId) return { handled: true, response: { success: false, error: 'Unable to sign in' } }

	const status = await config.store.getStatus(userId)
	const requiredByPolicy = config.isRequired ? await config.isRequired(user) : false
	if (!status.enabled && !requiredByPolicy) return { handled: false }
	if (!status.enabled) {
		return {
			handled: true,
			response: {
				success: false,
				mfaEnrollmentRequired: true,
				error: 'Multi-factor authentication enrollment is required'
			}
		}
	}

	const expiresInMs = config.challengeExpiresInMs ?? DEFAULT_LOGIN_CHALLENGE_TTL_MS
	const challenge = await createVerificationToken({
		adapter: config.verificationTokenAdapter,
		userId,
		type: VERIFICATION_TOKEN_TYPES.MFA_LOGIN,
		expiresInMs,
		metadata: challengeMetadata(sessionMetadata)
	})
	event.cookies.set(challengeCookieName(config), challenge, {
		httpOnly: true,
		maxAge: Math.max(1, Math.floor(expiresInMs / 1000)),
		path: '/',
		sameSite: 'lax',
		secure: config.secureCookies ?? true
	})

	return {
		handled: true,
		response: { success: true, twoFactorRequired: true }
	}
}

/** Completes a credential-login MFA challenge and only then creates the session. */
export function createMfaLoginVerifyHandler(
	config: MfaLoginConfig & {
		sessionAdapter: MfaLoginSessionAdapter
		sanitizeUser?: (user: Record<string, unknown>) => unknown
	}
) {
	return async (event: RequestEventLike) => {
		const cookieName = challengeCookieName(config)
		const challenge = event.cookies.get(cookieName)
		if (!challenge) return { success: false, error: 'Invalid or expired login challenge' }

		const inspected = await getVerificationTokenRecord({
			adapter: config.verificationTokenAdapter,
			token: challenge,
			type: VERIFICATION_TOKEN_TYPES.MFA_LOGIN
		})
		if (!inspected) return { success: false, error: 'Invalid or expired login challenge' }

		const userId = userIdFromRecord(inspected.user)
		if (!userId) return { success: false, error: 'Invalid or expired login challenge' }
		const status = await config.store.getStatus(userId)
		const secret = status.enabled ? await config.store.getSecret(userId) : null
		if (!secret) return { success: false, error: 'Invalid or expired login challenge' }

		const formData = await event.request.formData()
		const token = formData.get('token')?.toString() ?? ''
		const backupCode = formData.get('backupCode')?.toString() ?? ''
		let backupHash: string | null = null
		let valid = false

		if (token) {
			valid = await verifyTOTP({ secret, token })
		} else if (backupCode) {
			const backup = await verifyBackupCode({
				code: backupCode,
				hashedCodes: await config.store.getBackupCodes(userId)
			})
			valid = backup.valid
			backupHash = backup.hash ?? null
		}
		if (!valid) return { success: false, error: 'Invalid authentication code' }

		const consumed = await consumeVerificationTokenRecord({
			adapter: config.verificationTokenAdapter,
			token: challenge,
			type: VERIFICATION_TOKEN_TYPES.MFA_LOGIN
		})
		if (!consumed || userIdFromRecord(consumed.user) !== userId) {
			return { success: false, error: 'Invalid or expired login challenge' }
		}

		if (backupHash && !(await config.store.consumeBackupCode(userId, backupHash))) {
			return { success: false, error: 'Invalid authentication code' }
		}
		const session = await config.sessionAdapter.createSession(userId, {
			...challengeMetadata(consumed.token.metadata),
			mfaVerifiedAt: new Date()
		})
		config.sessionAdapter.setSessionCookie(event.cookies, session)
		event.cookies.delete(cookieName, { path: '/' })

		return {
			success: true,
			user: config.sanitizeUser ? config.sanitizeUser(consumed.user) : consumed.user
		}
	}
}

/** Creates mfa status handler for auth HTTP handlers. */
export function createMfaStatusHandler(config: MfaConfig) {
	const { getUserId, store } = config
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals)
		if (!userId) return { success: false, error: 'Unauthorized' }
		const status = await store.getStatus(userId)
		return { success: true, status }
	}
}

/**
 * Create MFA enrollment handler
 *
 * @param {Object} config - Configuration for this operation.
 */
export function createMfaEnrollHandler(config: MfaSecurityChangeConfig) {
	const { authorizeSecurityChange, getUserId, store, issuer, label } = config
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals)
		if (!userId) return { success: false, error: 'Unauthorized' }
		if (
			!(await authorizeSecurityChange({
				action: 'mfa.enroll',
				request: event.request.clone(),
				userId
			}))
		) {
			return { success: false, error: 'Reauthentication required' }
		}

		const secret = generateSecret()
		const otpLabel = label ? label(userId, event.locals) : String(userId)
		const otpInput: { secret: string; label: string; issuer?: string } = {
			secret,
			label: otpLabel
		}
		if (issuer) otpInput.issuer = issuer
		const otpauthUrl = createOtpAuthURL(otpInput)
		const backupCodes = generateBackupCodes()
		const hashedCodes = await hashBackupCodes(backupCodes)

		if (!(await store.beginEnrollment(userId, secret, hashedCodes))) {
			return { success: false, error: 'Multi-factor authentication is already enabled' }
		}

		return { success: true, secret, otpauthUrl, backupCodes }
	}
}

/**
 * Verify MFA token to enable MFA
 *
 * @param config - Configuration for this operation.
 */
export function createMfaVerifyHandler(config: MfaConfig) {
	const { getUserId, store } = config
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals)
		if (!userId) return { success: false, error: 'Unauthorized' }
		const formData = await event.request.formData()
		const token = formData.get('token')?.toString()
		const secret = await store.getSecret(userId)
		if (!secret) return { success: false, error: 'MFA enrollment not started' }
		const verifyInput: { secret: string; token?: string } = { secret }
		if (token) verifyInput.token = token
		const valid = await verifyTOTP(verifyInput)
		if (!valid) return { success: false, error: 'Invalid code' }
		if (!(await store.activateEnrollment(userId))) {
			return { success: false, error: 'MFA enrollment not started' }
		}
		return { success: true }
	}
}

/** Creates mfa disable handler for auth HTTP handlers. */
export function createMfaDisableHandler(config: MfaSecurityChangeConfig) {
	const { authorizeSecurityChange, getUserId, store } = config
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals)
		if (!userId) return { success: false, error: 'Unauthorized' }
		if (
			!(await authorizeSecurityChange({
				action: 'mfa.disable',
				request: event.request.clone(),
				userId
			}))
		) {
			return { success: false, error: 'Reauthentication required' }
		}

		const secret = await store.getSecret(userId)
		if (!secret) return { success: false, error: 'Multi-factor authentication is not enabled' }
		const formData = await event.request.formData()
		const token = formData.get('token')?.toString() ?? ''
		const backupCode = formData.get('backupCode')?.toString() ?? ''
		let valid = token ? await verifyTOTP({ secret, token }) : false
		if (!valid && backupCode) {
			const backup = await verifyBackupCode({
				code: backupCode,
				hashedCodes: await store.getBackupCodes(userId)
			})
			if (backup.valid && backup.hash) {
				valid = await store.consumeBackupCode(userId, backup.hash)
			}
		}
		if (!valid) return { success: false, error: 'Invalid authentication code' }
		if (!(await store.disableMfa(userId))) {
			return { success: false, error: 'Multi-factor authentication is not enabled' }
		}
		return { success: true }
	}
}

/** Creates mfa backup code handler for auth HTTP handlers. */
export function createMfaBackupCodeHandler(config: MfaConfig) {
	const { getUserId, store } = config
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals)
		if (!userId) return { success: false, error: 'Unauthorized' }
		const formData = await event.request.formData()
		const code = formData.get('code')?.toString()
		const hashedCodes = await store.getBackupCodes(userId)
		const result = await verifyBackupCode({ code: code ?? '', hashedCodes })
		if (!result.valid) return { success: false, error: 'Invalid backup code' }
		if (!result.hash) return { success: false, error: 'Invalid backup code' }
		if (!(await store.consumeBackupCode(userId, result.hash))) {
			return { success: false, error: 'Invalid backup code' }
		}
		return { success: true }
	}
}
