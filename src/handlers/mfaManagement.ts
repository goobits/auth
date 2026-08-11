import { generateBackupCodes, hashBackupCodes, verifyBackupCode } from '../mfa/backupCodes.ts'
import { createOtpAuthURL, generateSecret, matchTOTP } from '../mfa/totp.ts'
import type { CredentialMutationPort, RequestEventLike } from '../types/auth.ts'
import { createDefaultMfaCredentialMutations } from '../createAuth/credentialMutations.ts'
import { type AssuredSessionAdapter, rotateSessionAssurance } from './_assuredSession.ts'
import { consumeMfaCredentialProof, verifyMfaCredential } from './_mfaCredential.ts'
import type { MfaConfig, MfaSecurityChangeConfig } from './_mfaTypes.ts'
import { readRequestFormData } from '../utils/http.ts'

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

/** Begin a step-up-authorized MFA enrollment. */
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

/** Verify a pending factor and optionally rotate the current session assurance. */
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
		let enrollmentStarted = true
		const outcome = await mutation({
			userId,
			event,
			verify: async () => {
				const secret = await store.getSecret(userId)
				if (!secret) {
					enrollmentStarted = false
					return null
				}
				const match = await matchTOTP({ secret, token: token ?? '' })
				return match ? { method: 'totp', counter: match.counter } : null
			}
		})
		if (outcome === 'invalid-proof') {
			return {
				success: false,
				error: enrollmentStarted ? 'Invalid code' : 'MFA enrollment not started'
			}
		}
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

/** Disable an active factor after reauthentication and proof consumption. */
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

/** Consume a backup code independently of a session assurance rotation. */
export function createMfaBackupCodeHandler(config: MfaConfig) {
	const { getUserId, store } = config
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals)
		if (!userId) return { success: false, error: 'Unauthorized' }
		const formData = await readRequestFormData(event.request)
		const code = formData.get('code')?.toString()
		const hashedCodes = await store.getBackupCodes(userId)
		const result = await verifyBackupCode({ code: code ?? '', hashedCodes })
		if (!result.valid || !result.hash) return { success: false, error: 'Invalid backup code' }
		if (!(await store.consumeBackupCode(userId, result.hash))) {
			return { success: false, error: 'Invalid backup code' }
		}
		return { success: true }
	}
}
