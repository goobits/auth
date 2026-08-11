import type { CsrfFetchConfig } from '@goobits/security/csrf-client'

export type AuthClientEndpoints = {
	magicLinkRequest?: string
	magicLinkVerify?: string
	passkeyRegisterOptions?: string
	passkeyRegisterVerify?: string
	passkeyLoginOptions?: string
	passkeyLoginVerify?: string
	passkeyCredentials?: string
	passkeyStepUpOptions?: string
	passkeyStepUpVerify?: string
	mfaStatus?: string
	mfaEnroll?: string
	mfaVerify?: string
	mfaDisable?: string
	mfaBackupCode?: string
	mfaStepUp?: string
	sessions?: string
	sessionRevoke?: string
	oauthIdentities?: string
	oauthUnlink?: string
}

export type CreateAuthClientOptions = {
	baseUrl?: string
	basePath?: string
	csrf?: Omit<CsrfFetchConfig, 'fetch'>
	endpoints?: AuthClientEndpoints
	fetcher?: typeof fetch
	headers?: HeadersInit
}

export type AuthClientFailure = {
	success: false
	error: string
	code?: string
	status?: number
}

export type MfaEnrollmentResult =
	| AuthClientFailure
	| {
			success: true
			secret: string
			otpauthUrl: string
			backupCodes: string[]
	  }

export type MfaActionResult = AuthClientFailure | { success: true; mfaVerifiedAt?: string }

export type MfaStatusResult =
	| AuthClientFailure
	| {
			success: true
			status: {
				enabled: boolean
				enabledAt: string | null
				backupCodeCount: number
			}
	  }

export type PasskeyCredentialSummary = {
	credentialId: string
	name: string | null
	transports: string[] | null
	createdAt: string | null
	lastUsedAt: string | null
}

export type PasskeyListResult =
	| AuthClientFailure
	| { success: true; credentials: PasskeyCredentialSummary[] }

export type PasskeyOptionsResult =
	| AuthClientFailure
	| {
			success: true
			options: Record<string, unknown>
			challengeId: string
	  }

export type AuthSessionSummary = {
	id: string
	userId: string
	expiresAt: string
	createdAt: string | null
	lastActiveAt: string | null
	ip: string | null
	userAgent: string | null
	current: boolean
}

export type SessionListResult =
	| { ok: false; error: string }
	| { ok: true; sessions: AuthSessionSummary[] }

export type SessionActionResult = { ok: false; error: string } | { ok: true }

export type ResolvedAuthClientEndpoints = Required<AuthClientEndpoints>

export type AuthClientContext = {
	authFetch: typeof fetch
	endpoints: ResolvedAuthClientEndpoints
	jsonHeaders: HeadersInit
	withBase: (path: string) => string
}
