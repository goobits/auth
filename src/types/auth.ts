import type { Actions, RequestEvent } from '@sveltejs/kit'

import type { UserAdapter } from '../adapters/database/UserAdapter.ts'
import type { PasswordCredentialAdapter } from '../adapters/database/PasswordCredentialAdapter.ts'
import type { MagicLinkAdapter } from '../adapters/magic-link/MagicLinkAdapter.ts'
import type { MfaAdapter } from '../adapters/mfa/MfaAdapter.ts'
import type { OAuthIdentityAdapter } from '../adapters/oauth-identity/OAuthIdentityAdapter.ts'
import type { TokenAdapter } from '../adapters/oauth-token/TokenAdapter.ts'
import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import type { VerificationTokenAdapter } from '../adapters/verification-token/VerificationTokenAdapter.ts'
import type {
	WebAuthnAdapter,
	WebAuthnRegistrationAdapter
} from '../adapters/webauthn/WebAuthnAdapter.ts'
import type { OAuthProvider } from '../providers/OAuthProvider.ts'
import type { WebhookChannelOptions } from '@goobits/security/alerting'
import type { CsrfTokenStore } from '@goobits/security/csrf'
import type { SecurityAlertHandler, ThresholdRule } from '../security/alerts.ts'
import type { AuthEventEmitter } from '../security/events.ts'
import type { RateLimitStore, RateLimitWindow } from '@goobits/security/rate-limit'
import type { Logger } from '@goobits/security/logger'
import type {
	OAuthFlowIntent,
	OAuthProfile,
	OAuthTokens,
	AuthSession,
	SessionMetadata,
	SessionSummary,
	User
} from './core.ts'

/** Defines auth locals options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthLocals = {
	user?: User | null
	session?: AuthSession | null
}

/** Defines request event like options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type RequestEventLike = Omit<
	Pick<RequestEvent, 'request' | 'cookies' | 'params' | 'locals' | 'url'>,
	'params' | 'locals'
> & {
	params: Record<string, string | undefined>
	locals: AuthLocals
	getClientAddress?: () => string
}

/** Auth-owned request handler that is independent of a consumer's ambient SvelteKit locals. */
export type AuthRequestHandler = (event: RequestEventLike) => Response | Promise<Response>

/** Standard result for an application-owned destructive credential mutation. */
export type CredentialMutationOutcome = 'success' | 'not-found' | 'forbidden'

/** Verified MFA material whose persisted state must be consumed atomically. */
export type MfaCredentialProof =
	| { method: 'totp'; counter: number }
	| { method: 'backup-code'; hash: string }

/** Inputs for atomically consuming an MFA login challenge, proof, and session write. */
export type MfaLoginCompletionInput = {
	challengeId: string
	userId: string
	proof: MfaCredentialProof
	sessionMetadata: SessionMetadata
}

/** Result of an application-owned MFA factor mutation. */
export type MfaCredentialMutationOutcome = CredentialMutationOutcome | 'invalid-proof'

/** Pending MFA enrollment activation executed inside an application mutation boundary. */
export type MfaActivateCredentialMutationInput = {
	userId: string
	event: RequestEventLike
	verify: () => Promise<Extract<MfaCredentialProof, { method: 'totp' }> | null>
}

/** MFA removal executed inside an application mutation boundary. */
export type MfaDisableCredentialMutationInput = {
	userId: string
	event: RequestEventLike
	authorize: () => boolean | Promise<boolean>
	verify: () => Promise<MfaCredentialProof | null>
}

/** Verified OAuth connection material supplied to application-owned persistence. */
export type OAuthConnectCredentialMutationInput = {
	userId: string
	provider: string
	subject: string
	expectedIdentityUserId: string | null
	tokens: OAuthTokens
	intent: OAuthFlowIntent
	event: RequestEventLike
	completeAuthentication: () => Promise<void>
}

/** OAuth unlink context whose authorization must execute inside the mutation boundary. */
export type OAuthUnlinkCredentialMutationInput = {
	userId: string
	provider: string
	session: AuthSession
	authorizationRequest: Request
	event: RequestEventLike
	authorize: () => boolean | Promise<boolean>
	revokeTokens: (tokens: OAuthTokens) => Promise<void>
}

/** Passkey removal context whose authorization must execute inside the mutation boundary. */
export type WebAuthnRemoveCredentialMutationInput = {
	userId: string
	credentialId: string
	session: AuthSession
	authorizationRequest: Request
	event: RequestEventLike
	authorize: () => boolean | Promise<boolean>
}

/**
 * Optional application transaction boundary for credential mutations.
 *
 * Applications with multiple credential stores can replace the adapter-backed
 * defaults so authorization, recovery policy, persistence, session revocation,
 * and audit state share one serialized operation.
 */
export type CredentialMutationPort = {
	mfa?: {
		activate: (
			input: MfaActivateCredentialMutationInput
		) => Promise<MfaCredentialMutationOutcome> | MfaCredentialMutationOutcome
		disable: (
			input: MfaDisableCredentialMutationInput
		) => Promise<MfaCredentialMutationOutcome> | MfaCredentialMutationOutcome
	}
	oauth?: {
		connect: (
			input: OAuthConnectCredentialMutationInput
		) => Promise<{ linked: boolean }> | { linked: boolean }
		unlink: (
			input: OAuthUnlinkCredentialMutationInput
		) => Promise<CredentialMutationOutcome> | CredentialMutationOutcome
	}
	webauthn?: {
		remove: (
			input: WebAuthnRemoveCredentialMutationInput
		) => Promise<CredentialMutationOutcome> | CredentialMutationOutcome
	}
}

/** Defines oauth provider config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type OAuthProviderConfig = {
	provider: OAuthProvider
	scopes?: string[]
}

/** Defines auth urls options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthUrls = {
	login?: string
	afterLogin?: string
	afterLogout?: string
	oauthCancelled?: string
}

/** Defines auth cookies config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthCookiesConfig = {
	secure?: boolean
}

/** Defines on login mode options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type OnLoginMode = 'augment' | 'manual'

/** Verified authentication method passed through the shared lifecycle hook. */
export type AuthenticationMethod =
	| { kind: 'magic-link'; email: string }
	| { kind: 'passkey'; credentialId: string; userId: string }
	| {
			kind: 'oauth'
			intent: OAuthFlowIntent
			provider: string
			profile: OAuthProfile
			tokens: OAuthTokens
	  }

/** Shared input for application-owned authentication policy and auditing. */
export type AuthenticationLifecycleInput = {
	event: RequestEventLike
	method: AuthenticationMethod
	user: User | null
}

/** Resolve a principal or continue through a safe application-owned pending route. */
export type AuthenticationLifecycleResult = { userId?: string | number; redirectTo?: string } | void

/** Defines auth hooks options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthHooks = {
	getSessionMetadata?: (
		event: RequestEventLike,
		userId: string
	) => SessionMetadata | Promise<SessionMetadata>
	onSessionValidated?: (
		event: RequestEventLike,
		session: AuthSession,
		user: User
	) => Promise<void> | void
	onAuthentication?: (
		input: AuthenticationLifecycleInput
	) => Promise<AuthenticationLifecycleResult> | AuthenticationLifecycleResult
	/** Runs after every configured login-assurance gate passes, immediately before Auth creates a session. */
	beforeSessionCreate?: (input: AuthenticationLifecycleInput) => Promise<void> | void

	// "augment" keeps framework-managed session creation (default).
	// "manual" lets advanced callers fully manage session creation.
	onLoginMode?: OnLoginMode
	onLogout?: (event: RequestEventLike) => Promise<void> | void
	onError?: (event: RequestEventLike, error: unknown) => Promise<void> | void
}

/** Defines magic link config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type MagicLinkConfig = {
	send: {
		email: (payload: {
			email: string
			link: string
			otp: string | null
			token: string
			expiresAt: Date
			user: User | null
			redirectTo: string
			secureCookies: boolean
		}) => Promise<void> | void
	}
	settings: {
		/** Canonical public HTTPS origin used in emailed links. */
		baseUrl: string
		/** Secret with at least 32 bytes; required when OTP delivery is enabled. */
		otpPepper?: string | Uint8Array
		allowSignup?: boolean
		expiresInMs?: number
		magicLinkPath?: string
		includeOtp?: boolean
		otpDigits?: number
		singleUsePerEmail?: boolean
		secureCookies?: boolean
		normalizeEmail?: (email: string) => string
		requireUserConfirmation?: boolean
		confirmationCookieName?: string
		confirmationTtlSeconds?: number
		key?: (event: RequestEventLike) => string
	}
	limits?: {
		request?: (event: RequestEventLike) => Promise<void> | void
		verify?: (key: string) => Promise<{ allowed: boolean }>
	}
	hooks?: {
		getMetadata?: (event: RequestEventLike) => Promise<Record<string, unknown>>
		createUser?: (email: string, event: RequestEventLike) => Promise<User>
		sanitizeUser?: (user: User | null) => User | null
	}
}

/** Request context supplied after an owned WebAuthn credential changes. */
export type WebAuthnCredentialLifecycleInput = {
	userId: string
	credentialId: string
	event: RequestEventLike
}

/** Defines web authn config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type WebAuthnConfig = {
	authorizeSecurityChange: AuthorizeSecurityChange
	origin?: string
	rpID?: string
	rpName?: string
	timeoutMs?: number
	attestation?: 'none' | 'indirect' | 'direct' | 'enterprise'
	maxCredentialsPerUser?: number
	hooks?: {
		onCredentialCreated?: (input: WebAuthnCredentialLifecycleInput) => Promise<void> | void
		onCredentialDeleted?: (input: WebAuthnCredentialLifecycleInput) => Promise<void> | void
	}
}

/** Security-sensitive account mutation that requires fresh application authorization. */
export type SecurityChangeAction =
	| 'mfa.enroll'
	| 'mfa.disable'
	| 'webauthn.register'
	| 'webauthn.remove'

/** Application-owned step-up authorization for factor enrollment and removal. */
export type AuthorizeSecurityChange = (input: {
	action: SecurityChangeAction
	request: Request
	userId: string
	session: AuthSession | null
}) => boolean | Promise<boolean>

/** Shared policy for deferring primary login until TOTP or backup-code verification. */
export type MfaLoginPolicy = {
	isRequired?: (user: User) => boolean | Promise<boolean>
	/**
	 * Optional application transaction port. It must consume the challenge and
	 * proof and create the returned session atomically, returning null when any
	 * precondition no longer holds.
	 */
	completeLogin?: (input: MfaLoginCompletionInput) => Promise<AuthSession | null>
	challengeCookieName?: string
	challengeExpiresInMs?: number
	secureCookies?: boolean
	/** Safe application path that renders the pending MFA challenge. */
	challengeRedirect?: string
	/** Safe application path that explains required factor enrollment. */
	enrollmentRedirect?: string
}

/** Defines totp mfa config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type TotpMfaConfig = {
	authorizeSecurityChange: AuthorizeSecurityChange
	login?: MfaLoginPolicy
	issuer?: string
	label?: (userId: string, locals: RequestEventLike['locals']) => string
	hooks?: {
		onEnabled?: (input: { userId: string; event: RequestEventLike }) => Promise<void> | void
		onDisabled?: (input: { userId: string; event: RequestEventLike }) => Promise<void> | void
	}
}

/** Defines sessions config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type SessionsConfig = {
	listLimit?: number
}

/** Security-sensitive OAuth identity mutation. */
export type OAuthIdentityChangeAction = 'oauth.link' | 'oauth.unlink'

/** Application-owned fresh-assurance policy for linking and unlinking providers. */
export type AuthorizeOAuthIdentityChange = (input: {
	action: OAuthIdentityChangeAction
	request: Request
	userId: string
	session: AuthSession | null
	provider: string
}) => boolean | Promise<boolean>

/** OAuth connection lifecycle configuration. */
export type OAuthIdentityConfig = {
	authorizeIdentityChange: AuthorizeOAuthIdentityChange
	hooks?: {
		onLinked?: (input: {
			userId: string
			provider: string
			subject: string
			event: RequestEventLike
		}) => Promise<void> | void
		onUnlinked?: (input: {
			userId: string
			provider: string
			event: RequestEventLike
		}) => Promise<void> | void
	}
}

/** Defines security profile options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type SecurityProfile = 'basic' | 'secure' | 'strict'
/** Defines security mode options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type SecurityMode = 'required' | 'optional' | 'off'
/** Defines trusted proxy headers that may supply client addresses for rate limits. */
export type TrustedProxyHeader = 'cf-connecting-ip' | 'x-forwarded-for'
/** Defines auth alert webhook config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthAlertWebhookConfig = Omit<WebhookChannelOptions, 'url'> & {
	url?: string | null
}

/** Defines auth security config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthSecurityConfig = {
	requestOrigin?: {
		mode?: SecurityMode
		/** Additional trusted browser origins beyond the current request URL origin. */
		allowedOrigins?: string[]
		/** Application-owned replacement for the built-in Security origin verifier. */
		validate?: (event: RequestEventLike) => boolean | Promise<boolean>
	}
	csrf?: {
		mode?: SecurityMode
		/** HMAC secret for session-bound CSRF tokens. Must contain at least 32 bytes. */
		secret?: string | Uint8Array
		cookieName?: string
		headerName?: string
		checkExpiry?: boolean
		httpOnly?: boolean
		store?: CsrfTokenStore
	}
	rateLimit?: {
		mode?: SecurityMode
		/** Multi-window policy. Defaults to the canonical login policy for secure profiles. */
		windows?: RateLimitWindow[]
		keyPrefix?: string
		trustedProxyHeaders?: TrustedProxyHeader[]
		/** Trusted append-style X-Forwarded-For hops, counted from the server side. */
		forwardedForTrustedProxyHops?: number
		store?: RateLimitStore
	}
	audit?: {
		mode?: SecurityMode
		emitter?: AuthEventEmitter
	}
	alerts?: {
		enabled?: boolean
		onAlert?: SecurityAlertHandler
		rules?: ThresholdRule[]
		store?: RateLimitStore
		keyPrefix?: string
		webhook?: AuthAlertWebhookConfig
	}
}

/** Explicit persistence capabilities available to auth flows. */
export type AuthAdapters = {
	session: SessionAdapter
	user?: UserAdapter
	oauthIdentity?: OAuthIdentityAdapter
	passwordCredential?: PasswordCredentialAdapter
	oauthToken?: TokenAdapter
	verificationToken?: VerificationTokenAdapter
	magicLink?: MagicLinkAdapter
	mfa?: MfaAdapter
	webauthn?: WebAuthnAdapter
}

type CommonAuthConfigFields = {
	providers?: Record<string, OAuthProviderConfig>
	urls?: AuthUrls
	cookies?: AuthCookiesConfig
	hooks?: AuthHooks
	autoCreateSession?: boolean
	isAuthenticated?: (locals: AuthLocals) => boolean
	sanitizeUser?: (user: User | null) => User | null
	profile?: SecurityProfile
	security?: AuthSecurityConfig
	sessions?: SessionsConfig
	oauth?: OAuthIdentityConfig
	credentialMutations?: CredentialMutationPort
	mfa?: TotpMfaConfig
	logger?: Logger
}

type AuthConfigNoFeatures = CommonAuthConfigFields & {
	adapters: AuthAdapters
	magicLink?: undefined
	webauthn?: undefined
}

type AuthConfigWithMagicLink = CommonAuthConfigFields & {
	adapters: AuthAdapters & { magicLink: MagicLinkAdapter }
	magicLink: MagicLinkConfig
	webauthn?: undefined
}

type AuthConfigWithWebAuthn = CommonAuthConfigFields & {
	adapters: AuthAdapters & { webauthn: WebAuthnRegistrationAdapter }
	magicLink?: undefined
	webauthn: WebAuthnConfig
}

type AuthConfigWithBoth = CommonAuthConfigFields & {
	adapters: AuthAdapters & {
		magicLink: MagicLinkAdapter
		webauthn: WebAuthnRegistrationAdapter
	}
	magicLink: MagicLinkConfig
	webauthn: WebAuthnConfig
}

/** Defines auth config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthConfig =
	| AuthConfigNoFeatures
	| AuthConfigWithMagicLink
	| AuthConfigWithWebAuthn
	| AuthConfigWithBoth

/** Defines auth handlers options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthHandlers = {
	login?: AuthRequestHandler
	callback?: AuthRequestHandler
	logout: AuthRequestHandler
	hooks: (input: {
		event: RequestEventLike
		resolve: (e: RequestEventLike) => Promise<Response>
	}) => Promise<Response>
	magicLink?: {
		request: AuthRequestHandler
		verify: AuthRequestHandler
	}
	webauthn?: {
		registerOptions: AuthRequestHandler
		registerVerify: AuthRequestHandler
		loginOptions: AuthRequestHandler
		loginVerify: AuthRequestHandler
		listCredentials: AuthRequestHandler
		removeCredential: AuthRequestHandler
		stepUpOptions: AuthRequestHandler
		stepUpVerify: AuthRequestHandler
	}
	mfa?: {
		status: AuthRequestHandler
		enroll: AuthRequestHandler
		verify: AuthRequestHandler
		disable: AuthRequestHandler
		backupCode: AuthRequestHandler
		stepUp: AuthRequestHandler
	}
	sessions?: {
		list: AuthRequestHandler
		revoke: AuthRequestHandler
	}
	oauth?: {
		identities: AuthRequestHandler
		unlink: AuthRequestHandler
	}
}

/** Defines auth routes options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthRoutes = {
	login: () => { GET: AuthRequestHandler }
	callback: () => { GET: AuthRequestHandler; POST: AuthRequestHandler }
	logout: () => { POST: AuthRequestHandler }
	magicLink: () => { POST: AuthRequestHandler }
	magicLinkVerify: () => { GET: AuthRequestHandler; POST: AuthRequestHandler }
	passkeyRegisterOptions: () => { POST: AuthRequestHandler }
	passkeyRegisterVerify: () => { POST: AuthRequestHandler }
	passkeyLoginOptions: () => { POST: AuthRequestHandler }
	passkeyLoginVerify: () => { POST: AuthRequestHandler }
	passkeyCredentials: () => { GET: AuthRequestHandler; POST: AuthRequestHandler }
	passkeyStepUpOptions: () => { POST: AuthRequestHandler }
	passkeyStepUpVerify: () => { POST: AuthRequestHandler }
	mfaStatus: () => { GET: AuthRequestHandler }
	mfaEnroll: () => { POST: AuthRequestHandler }
	mfaVerify: () => { POST: AuthRequestHandler }
	mfaDisable: () => { POST: AuthRequestHandler }
	mfaBackupCode: () => { POST: AuthRequestHandler }
	mfaStepUp: () => { POST: AuthRequestHandler }
	sessions: () => { GET: AuthRequestHandler; POST: AuthRequestHandler }
	oauthIdentities: () => { GET: AuthRequestHandler }
	oauthUnlink: () => { POST: AuthRequestHandler }
}

/** Defines auth form actions for wiring handlers into SvelteKit pages. */
export type AuthActions = {
	logout: () => Actions
}

/** Defines session list response options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type SessionListResponse = {
	ok: boolean
	sessions: SessionSummary[]
}
