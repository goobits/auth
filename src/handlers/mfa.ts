import type { VerificationTokenAdapter } from '../adapters/verification-token/VerificationTokenAdapter.ts'
import type { MfaAdapter } from '../adapters/mfa/MfaAdapter.ts'
import type { Session, SessionMetadata, User } from '../types/core.ts'
import { generateBackupCodes, hashBackupCodes, verifyBackupCode } from '../mfa/backupCodes.ts'
import { createOtpAuthURL, generateSecret, matchTOTP } from '../mfa/totp.ts'
import type {
	AuthorizeSecurityChange,
	CredentialMutationPort,
	MfaLoginPolicy,
	RequestEventLike,
	TotpMfaConfig
} from '../types/auth.ts'
import {
	consumeVerificationTokenRecord,
	createVerificationToken,
	getVerificationTokenRecord,
	VERIFICATION_TOKEN_TYPES
} from '../verification/index.ts'
import { type AssuredSessionAdapter, rotateSessionAssurance } from './_assuredSession.ts'
import { consumeMfaCredentialProof, verifyMfaCredential } from './_mfaCredential.ts'
import {
	createStandaloneSecurityBoundaryValidator,
	type StandaloneSecurityBoundary
} from './_standaloneSecurity.ts'
import { createDefaultMfaCredentialMutations } from '../createAuth/credentialMutations.ts'
import { resolveHandlerRateLimitKey, type HandlerRateLimitConfig } from './rateLimitKey.ts'
import { readRequestFormData } from '../utils/http.ts'
import { isSafeRedirectPath } from '../utils/redirect.ts'

const DEFAULT_LOGIN_CHALLENGE_COOKIE = 'goobits_mfa_login'
const DEFAULT_LOGIN_CHALLENGE_TTL_MS = 5 * 60 * 1000

/** Mfa Store typed model for runtime integration. */
export type MfaStore = Pick<
	MfaAdapter,
	| 'activateEnrollment'
	| 'beginEnrollment'
	| 'consumeBackupCode'
	| 'consumeTotpCounter'
	| 'disableMfa'
	| 'getBackupCodes'
	| 'getSecret'
	| 'getStatus'
>

/** Mfa Config typed model for runtime integration. */
export type MfaConfig = {
	getUserId: (locals: RequestEventLike['locals']) => string | null
	store: MfaStore
	issuer?: string
	label?: (userId: string, locals: RequestEventLike['locals']) => string
	hooks?: TotpMfaConfig['hooks']
}

/** Configuration for MFA operations that change a user's factors. */
type MfaSecurityChangeConfig = MfaConfig & {
	authorizeSecurityChange: AuthorizeSecurityChange
}

export type MfaLoginAttemptContext = {
	challengeId: string
	event: RequestEventLike
	user: Record<string, unknown>
	userId: string
}

export type MfaLoginDenial = {
	allowed: false
	error: string
	code?: string
	status?: number
}

export type MfaLoginAttemptPolicy = {
	beforeVerify?: (
		context: MfaLoginAttemptContext
	) => MfaLoginDenial | void | Promise<MfaLoginDenial | void>
	onFailure?: (
		context: MfaLoginAttemptContext & {
			reason: 'credential-already-used' | 'invalid-credential'
		}
	) => Promise<void> | void
	onSuccess?: (context: MfaLoginAttemptContext) => Promise<void> | void
}

/** Configuration shared by credential signin and MFA challenge verification. */
export type MfaLoginConfig = {
	store: MfaStore
	verificationTokenAdapter: VerificationTokenAdapter
	csrf?: { validate: (event: RequestEventLike) => Promise<boolean>; errorMessage?: string }
	rateLimit?: HandlerRateLimitConfig
	attemptPolicy?: MfaLoginAttemptPolicy
	onVerified?: (
		user: Record<string, unknown>,
		context: {
			event: RequestEventLike
			formData: FormData
			sessionMetadata: SessionMetadata
		}
	) => MfaLoginDenial | void | Promise<MfaLoginDenial | void>
} & MfaLoginPolicy &
	StandaloneSecurityBoundary

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
		sessionAdapter: MfaLoginSessionAdapter
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
		if (hookResult?.allowed === false) {
			return deniedResponse(hookResult)
		}
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
		const redirectTo = challengeRedirect(consumed.token.metadata)
		const session = await config.sessionAdapter.createSession(userId, {
			...sessionMetadata,
			mfaVerifiedAt: new Date()
		})
		config.sessionAdapter.setSessionCookie(event.cookies, session)
		event.cookies.delete(cookieName, { path: '/' })
		await config.attemptPolicy?.onSuccess?.(attemptContext)

		return {
			success: true,
			user: config.sanitizeUser ? config.sanitizeUser(consumed.user) : consumed.user,
			...(redirectTo ? { redirectTo } : {})
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
				userId,
				session: event.locals.session ?? null
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
export function createMfaVerifyHandler(
	config: MfaConfig & {
		mutation?: NonNullable<CredentialMutationPort['mfa']>['activate']
		sessionAdapter?: AssuredSessionAdapter
	}
) {
	const { getUserId, store } = config
	const mutation =
		config.mutation ??
		createDefaultMfaCredentialMutations({ mfaAdapter: store, hooks: config.hooks }).activate
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals)
		if (!userId) return { success: false, error: 'Unauthorized' }
		const currentSession = event.locals.session
		if (config.sessionAdapter && (!currentSession || currentSession.userId !== userId)) {
			return { success: false, error: 'Unauthorized' }
		}
		const formData = await readRequestFormData(event.request)
		const token = formData.get('token')?.toString()
		const secret = await store.getSecret(userId)
		if (!secret) return { success: false, error: 'MFA enrollment not started' }
		const outcome = await mutation({
			userId,
			event,
			verify: async () => {
				const match = await matchTOTP({ secret, token: token ?? '' })
				return match ? { method: 'totp', counter: match.counter } : null
			}
		})
		if (outcome === 'invalid-proof') return { success: false, error: 'Invalid code' }
		if (outcome !== 'success') {
			return { success: false, error: 'MFA enrollment not started' }
		}
		if (!config.sessionAdapter || !currentSession) return { success: true }
		const replacement = await rotateSessionAssurance({
			sessionAdapter: config.sessionAdapter,
			assurance: 'mfa',
			cookies: event.cookies,
			currentSession,
			userId
		})
		return { success: true, mfaVerifiedAt: replacement.mfaVerifiedAt }
	}
}

/** Creates mfa disable handler for auth HTTP handlers. */
export function createMfaDisableHandler(
	config: MfaSecurityChangeConfig & {
		mutation?: NonNullable<CredentialMutationPort['mfa']>['disable']
	}
) {
	const { authorizeSecurityChange, getUserId, store } = config
	const mutation =
		config.mutation ??
		createDefaultMfaCredentialMutations({ mfaAdapter: store, hooks: config.hooks }).disable
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals)
		if (!userId) return { success: false, error: 'Unauthorized' }
		const authorizationRequest = event.request.clone()
		const formData = await readRequestFormData(event.request)
		const token = formData.get('token')?.toString() ?? ''
		const backupCode = formData.get('backupCode')?.toString() ?? ''
		const outcome = await mutation({
			userId,
			event,
			authorize: () =>
				authorizeSecurityChange({
					action: 'mfa.disable',
					request: authorizationRequest,
					userId,
					session: event.locals.session ?? null
				}),
			verify: () => verifyMfaCredential({ store, userId, token, backupCode })
		})
		if (outcome === 'forbidden') {
			return { success: false, error: 'Reauthentication required' }
		}
		if (outcome === 'invalid-proof') {
			return { success: false, error: 'Invalid authentication code' }
		}
		if (outcome !== 'success') {
			return { success: false, error: 'Multi-factor authentication is not enabled' }
		}
		return { success: true }
	}
}

/** Verifies a second factor and rotates the current session with fresh MFA assurance. */
export function createMfaStepUpHandler(
	config: MfaConfig & { sessionAdapter: AssuredSessionAdapter }
) {
	return async (event: RequestEventLike) => {
		const userId = config.getUserId(event.locals)
		const currentSession = event.locals.session
		if (!userId || !currentSession || currentSession.userId !== userId) {
			return { success: false, error: 'Unauthorized' }
		}
		const formData = await readRequestFormData(event.request)
		const proof = await verifyMfaCredential({
			store: config.store,
			userId,
			token: formData.get('token')?.toString() ?? '',
			backupCode: formData.get('backupCode')?.toString() ?? ''
		})
		if (!proof || !(await consumeMfaCredentialProof(config.store, userId, proof))) {
			return { success: false, error: 'Invalid authentication code' }
		}

		const replacement = await rotateSessionAssurance({
			sessionAdapter: config.sessionAdapter,
			assurance: 'mfa',
			cookies: event.cookies,
			currentSession,
			userId
		})
		return { success: true, mfaVerifiedAt: replacement.mfaVerifiedAt }
	}
}

/** Creates mfa backup code handler for auth HTTP handlers. */
export function createMfaBackupCodeHandler(config: MfaConfig) {
	const { getUserId, store } = config
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals)
		if (!userId) return { success: false, error: 'Unauthorized' }
		const formData = await readRequestFormData(event.request)
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
