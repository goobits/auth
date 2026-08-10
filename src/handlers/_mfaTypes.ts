import type { MfaAdapter } from '../adapters/mfa/MfaAdapter.ts'
import type { VerificationTokenAdapter } from '../adapters/verification-token/VerificationTokenAdapter.ts'
import type {
	AuthorizeSecurityChange,
	MfaLoginPolicy,
	RequestEventLike,
	TotpMfaConfig
} from '../types/auth.ts'
import type { SessionMetadata } from '../types/core.ts'
import type { HandlerRateLimitConfig } from './rateLimitKey.ts'
import type { StandaloneSecurityBoundary } from './_standaloneSecurity.ts'

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

export type MfaConfig = {
	getUserId: (locals: RequestEventLike['locals']) => string | null
	store: MfaStore
	issuer?: string
	label?: (userId: string, locals: RequestEventLike['locals']) => string
	hooks?: TotpMfaConfig['hooks']
}

export type MfaSecurityChangeConfig = MfaConfig & {
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
