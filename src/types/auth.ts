import type { Actions, RequestEvent } from '@sveltejs/kit'

import type { UserAdapter } from '../adapters/database/UserAdapter.ts'
import type { PasswordCredentialAdapter } from '../adapters/database/PasswordCredentialAdapter.ts'
import type { MagicLinkAdapter } from '../adapters/magic-link/MagicLinkAdapter.ts'
import type { MfaAdapter } from '../adapters/mfa/MfaAdapter.ts'
import type { TokenAdapter } from '../adapters/oauth-token/TokenAdapter.ts'
import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import type { VerificationTokenAdapter } from '../adapters/verification-token/VerificationTokenAdapter.ts'
import type { WebAuthnAdapter } from '../adapters/webauthn/WebAuthnAdapter.ts'
import type { OAuthProvider } from '../providers/OAuthProvider.ts'
import type { WebhookChannelOptions } from '@goobits/security/alerting'
import type { CsrfTokenStore } from '@goobits/security/csrf'
import type { SecurityAlertHandler, ThresholdRule } from '../security/alerts.ts'
import type { AuthEventEmitter } from '../security/events.ts'
import type { RateLimitStore, RateLimitWindow } from '@goobits/security/rate-limit'
import type { Logger } from '@goobits/security/logger'
import type {
	OAuthProfile,
	OAuthTokens,
	Session,
	SessionMetadata,
	SessionSummary,
	User
} from './core.ts'

/** Defines auth locals options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthLocals = {
	user?: User | null
	session?: Session | null
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
}

/** Defines auth cookies config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthCookiesConfig = {
	secure?: boolean
}

/** Defines auth login result options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthLoginResult = { userId: string | number } | void
/** Defines on login mode options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type OnLoginMode = 'augment' | 'manual'

/** Defines auth hooks options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthHooks = {
	getSessionMetadata?: (
		event: RequestEventLike,
		userId: string
	) => SessionMetadata | Promise<SessionMetadata>
	onSessionValidated?: (
		event: RequestEventLike,
		session: Session,
		user: User
	) => Promise<void> | void
	onLogin?: (
		event: RequestEventLike,
		profile: OAuthProfile,
		tokens: OAuthTokens | null,
		user?: User | null
	) => Promise<AuthLoginResult> | AuthLoginResult

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
		onLogin?: AuthHooks['onLogin']
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
		onLogin?: AuthHooks['onLogin']
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
	session: Session | null
}) => boolean | Promise<boolean>

/** Defines totp mfa config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type TotpMfaConfig = {
	authorizeSecurityChange: AuthorizeSecurityChange
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
	csrf?: {
		mode?: SecurityMode
		/** Executable application-owned request boundary used only when built-in CSRF is off. */
		validateExternalSecurityBoundary?: (event: RequestEventLike) => boolean | Promise<boolean>
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
	requireVerifiedEmailForLinking?: boolean
	isAuthenticated?: (locals: AuthLocals) => boolean
	sanitizeUser?: (user: User | null) => User | null
	profile?: SecurityProfile
	security?: AuthSecurityConfig
	sessions?: SessionsConfig
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
	adapters: AuthAdapters & { webauthn: WebAuthnAdapter }
	magicLink?: undefined
	webauthn: WebAuthnConfig
}

type AuthConfigWithBoth = CommonAuthConfigFields & {
	adapters: AuthAdapters & {
		magicLink: MagicLinkAdapter
		webauthn: WebAuthnAdapter
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
}

/** Defines auth routes options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthRoutes = {
	login: () => { GET: AuthRequestHandler }
	callback: () => { GET: AuthRequestHandler }
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
