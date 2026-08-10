import type { Session, SessionMetadata, User } from '../types/core.ts'
import type { RequestEventLike } from '../types/auth.ts'
import {
	consumeVerificationTokenRecord,
	createVerificationToken,
	getVerificationTokenRecord,
	VERIFICATION_TOKEN_TYPES
} from '../verification/index.ts'
import { consumeMfaCredentialProof, verifyMfaCredential } from './_mfaCredential.ts'
import type { MfaLoginAttemptContext, MfaLoginConfig, MfaLoginDenial } from './_mfaTypes.ts'
import { createStandaloneSecurityBoundaryValidator } from './_standaloneSecurity.ts'
import { resolveHandlerRateLimitKey } from './rateLimitKey.ts'
import { readRequestFormData } from '../utils/http.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'

const DEFAULT_LOGIN_CHALLENGE_COOKIE = 'goobits_mfa_login'
const DEFAULT_LOGIN_CHALLENGE_TTL_MS = 5 * 60 * 1000

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

function challengeRedirect(record: Record<string, unknown> | undefined): string | undefined {
	const redirectTo = record?.['redirectTo']
	return typeof redirectTo === 'string' &&
		redirectTo.length <= 1024 &&
		isSafeRedirectPath(redirectTo)
		? redirectTo
		: undefined
}

function challengeTokenMetadata(
	sessionMetadata: SessionMetadata,
	redirectTo: string | undefined
): Record<string, unknown> {
	return {
		...challengeMetadata(sessionMetadata),
		...(redirectTo && redirectTo.length <= 1024 && isSafeRedirectPath(redirectTo)
			? { redirectTo }
			: {})
	}
}

export type MfaLoginChallengeResponse = {
	success: boolean
	twoFactorRequired?: boolean
	mfaEnrollmentRequired?: boolean
	error?: string
}

/** Starts a short-lived, single-use MFA challenge when the authenticated password requires it. */
export async function beginMfaLoginChallenge({
	event,
	user,
	sessionMetadata,
	redirectTo,
	config
}: {
	event: RequestEventLike
	user: User
	sessionMetadata: SessionMetadata
	redirectTo?: string
	config: MfaLoginConfig
}): Promise<
	| { handled: false }
	| {
			handled: true
			response: MfaLoginChallengeResponse
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
		metadata: challengeTokenMetadata(sessionMetadata, redirectTo)
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
		sessionAdapter: {
			createSession: (userId: string, metadata?: SessionMetadata) => Promise<Session>
			setSessionCookie: (cookies: RequestEventLike['cookies'], session: Session) => void
		}
		sanitizeUser?: (user: Record<string, unknown>) => unknown
	}
) {
	const validateRequestBoundary = createStandaloneSecurityBoundaryValidator(
		'createMfaLoginVerifyHandler',
		{
			hasCsrf: typeof config.csrf?.validate === 'function',
			hasRateLimit: typeof config.rateLimit?.check === 'function',
			...(config.validateExternalSecurityBoundary
				? { validateExternalSecurityBoundary: config.validateExternalSecurityBoundary }
				: {})
		}
	)
	const deniedResponse = (denial: MfaLoginDenial) => ({
		success: false as const,
		error: denial.error,
		...(denial.code ? { code: denial.code } : {}),
		...(denial.status ? { status: denial.status } : {})
	})

	return async (event: RequestEventLike) => {
		if (!(await validateRequestBoundary(event))) {
			return { success: false, error: 'Invalid security boundary' }
		}
		if (config.csrf && !(await config.csrf.validate(event))) {
			return { success: false, error: config.csrf.errorMessage ?? 'Invalid CSRF token' }
		}
		if (config.rateLimit?.check) {
			const verdict = await config.rateLimit.check(
				resolveHandlerRateLimitKey(event, config.rateLimit)
			)
			if (!verdict.allowed) {
				return { success: false, error: 'Too many attempts. Try again later.' }
			}
		}
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
		const attemptContext: MfaLoginAttemptContext = {
			challengeId: inspected.token.id,
			event,
			user: inspected.user,
			userId
		}
		const attemptDenial = await config.attemptPolicy?.beforeVerify?.(attemptContext)
		if (attemptDenial?.allowed === false) return deniedResponse(attemptDenial)
		const formData = await readRequestFormData(event.request)
		const token = formData.get('token')?.toString() ?? ''
		const backupCode = formData.get('backupCode')?.toString() ?? ''
		const proof = await verifyMfaCredential({
			store: config.store,
			userId,
			token,
			backupCode
		})
		if (!proof) {
			await config.attemptPolicy?.onFailure?.({
				...attemptContext,
				reason: 'invalid-credential'
			})
			return { success: false, error: 'Invalid authentication code' }
		}
		const sessionMetadata = challengeMetadata(inspected.token.metadata)
		const hookResult = await config.onVerified?.(inspected.user, {
			event,
			formData,
			sessionMetadata: { ...sessionMetadata }
		})
		if (hookResult?.allowed === false) return deniedResponse(hookResult)

		const completedSessionMetadata = {
			...sessionMetadata,
			mfaVerifiedAt: new Date()
		}
		let authenticatedUser = inspected.user
		let redirectTo = challengeRedirect(inspected.token.metadata)
		let session: Session | null

		if (config.completeLogin) {
			session = await config.completeLogin({
				challengeId: inspected.token.id,
				userId,
				proof,
				sessionMetadata: completedSessionMetadata
			})
			if (!session) {
				await config.attemptPolicy?.onFailure?.({
					...attemptContext,
					reason: 'credential-already-used'
				})
				return { success: false, error: 'Invalid authentication code' }
			}
		} else {
			if (!(await consumeMfaCredentialProof(config.store, userId, proof))) {
				await config.attemptPolicy?.onFailure?.({
					...attemptContext,
					reason: 'credential-already-used'
				})
				return { success: false, error: 'Invalid authentication code' }
			}

			const consumed = await consumeVerificationTokenRecord({
				adapter: config.verificationTokenAdapter,
				token: challenge,
				type: VERIFICATION_TOKEN_TYPES.MFA_LOGIN
			})
			if (!consumed || userIdFromRecord(consumed.user) !== userId) {
				return { success: false, error: 'Invalid or expired login challenge' }
			}
			authenticatedUser = consumed.user
			redirectTo = challengeRedirect(consumed.token.metadata)
			session = await config.sessionAdapter.createSession(userId, completedSessionMetadata)
		}
		config.sessionAdapter.setSessionCookie(event.cookies, session)
		event.cookies.delete(cookieName, { path: '/' })
		await config.attemptPolicy?.onSuccess?.(attemptContext)

		return {
			success: true,
			user: config.sanitizeUser ? config.sanitizeUser(authenticatedUser) : authenticatedUser,
			...(redirectTo ? { redirectTo } : {})
		}
	}
}
