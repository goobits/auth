import type { RequestEvent, RequestHandler } from '@sveltejs/kit'

import type { UserAdapter } from '../adapters/database/UserAdapter.ts'
import type { MagicLinkAdapter } from '../adapters/magic-link/MagicLinkAdapter.ts'
import type { MfaAdapter } from '../adapters/mfa/MfaAdapter.ts'
import type { TokenAdapter } from '../adapters/oauth-token/TokenAdapter.ts'
import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'
import type { VerificationTokenAdapter } from '../adapters/verification-token/VerificationTokenAdapter.ts'
import type { WebAuthnAdapter } from '../adapters/webauthn/WebAuthnAdapter.ts'
import type { OAuthProvider } from '../providers/OAuthProvider.ts'
import type { WebhookChannelOptions } from '@goobits/security/alerting'
import type { CsrfTokenStore } from '@goobits/security/csrf'
import type { SecurityAlertHandler } from '../security/alerts.ts'
import type { AuthEventEmitter } from '../security/events.ts'
import type { RateLimitStore } from '@goobits/security/rate-limit'
import type { Logger } from '../utils/logger.ts'
import type { OAuthProfile, OAuthTokens, Session, SessionSummary, User } from './core.ts'

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
	settings?: {
		allowSignup?: boolean
		expiresInMs?: number
		magicLinkPath?: string
		includeOtp?: boolean
		otpDigits?: number
		singleUsePerEmail?: boolean
		secureCookies?: boolean
		normalizeEmail?: (email: string) => string
		exposeToken?: boolean
		baseUrl?: string
		trustProxyHeader?: boolean
		key?: (event: RequestEventLike) => string
	}
	limits?: {
		request?: (event: RequestEventLike) => Promise<void> | void
		verify?: (key: string) => Promise<{ allowed: boolean }>
		verifyMax?: number
		verifyWindowMs?: number
	}
	hooks?: {
		onLogin?: AuthHooks['onLogin']
		getMetadata?: (event: RequestEventLike) => Promise<Record<string, unknown>>
		createUser?: (email: string, event: RequestEventLike) => Promise<User>
		sanitizeUser?: (user: User | null) => User | null
	}
}

/** Defines web authn config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type WebAuthnConfig = {
	authorizeSecurityChange: AuthorizeSecurityChange
	origin?: string
	rpID?: string
	rpName?: string
	timeoutMs?: number
	attestation?: 'none' | 'indirect' | 'direct' | 'enterprise'
	userVerification?: 'required' | 'preferred' | 'discouraged'
	credentialName?: string
	hooks?: {
		onLogin?: AuthHooks['onLogin']
	}
}

/** Security-sensitive account mutation that requires fresh application authorization. */
export type SecurityChangeAction = 'mfa.enroll' | 'mfa.disable' | 'webauthn.register'

/** Application-owned step-up authorization for factor enrollment and removal. */
export type AuthorizeSecurityChange = (input: {
	action: SecurityChangeAction
	request: Request
	userId: string
}) => boolean | Promise<boolean>

/** Defines totp mfa config options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type TotpMfaConfig = {
	authorizeSecurityChange: AuthorizeSecurityChange
	issuer?: string
	label?: (userId: string, locals: RequestEventLike['locals']) => string
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
		/** Set only when the application enforces an equivalent request boundary before auth routes. */
		externalBoundary?: boolean
		cookieName?: string
		headerName?: string
		checkExpiry?: boolean
		httpOnly?: boolean
		store?: CsrfTokenStore
	}
	rateLimit?: {
		mode?: SecurityMode
		max?: number
		windowMs?: number
		keyPrefix?: string
		trustProxyHeader?: boolean
		trustedProxyHeaders?: TrustedProxyHeader[]
		store?: RateLimitStore
	}
	audit?: {
		mode?: SecurityMode
		emitter?: AuthEventEmitter
	}
	alerts?: {
		enabled?: boolean
		onAlert?: SecurityAlertHandler
		webhook?: AuthAlertWebhookConfig
	}
}

type BaseAuthAdapters = {
	session: SessionAdapter
	user?: UserAdapter
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
	adapters: BaseAuthAdapters
	magicLink?: undefined
	webauthn?: undefined
}

type AuthConfigWithMagicLink = CommonAuthConfigFields & {
	adapters: BaseAuthAdapters & { magicLink: MagicLinkAdapter }
	magicLink: MagicLinkConfig
	webauthn?: undefined
}

type AuthConfigWithWebAuthn = CommonAuthConfigFields & {
	adapters: BaseAuthAdapters & { webauthn: WebAuthnAdapter }
	magicLink?: undefined
	webauthn: WebAuthnConfig
}

type AuthConfigWithBoth = CommonAuthConfigFields & {
	adapters: BaseAuthAdapters & {
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
	login?: RequestHandler
	callback?: RequestHandler
	logout: RequestHandler
	hooks: (input: {
		event: RequestEventLike
		resolve: (e: RequestEventLike) => Promise<Response>
	}) => Promise<Response>
	magicLink?: {
		request: RequestHandler
		verify: RequestHandler
	}
	webauthn?: {
		registerOptions: RequestHandler
		registerVerify: RequestHandler
		loginOptions: RequestHandler
		loginVerify: RequestHandler
	}
	mfa?: {
		status: RequestHandler
		enroll: RequestHandler
		verify: RequestHandler
		disable: RequestHandler
		backupCode: RequestHandler
	}
	sessions?: {
		list: RequestHandler
		revoke: RequestHandler
	}
}

/** Defines auth routes options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type AuthRoutes = {
	login: () => { GET: RequestHandler }
	callback: () => { GET: RequestHandler }
	logout: () => { POST: RequestHandler }
	magicLink: () => { POST: RequestHandler }
	magicLinkVerify: () => { GET: RequestHandler; POST: RequestHandler }
	passkeyRegisterOptions: () => { POST: RequestHandler }
	passkeyRegisterVerify: () => { POST: RequestHandler }
	passkeyLoginOptions: () => { POST: RequestHandler }
	passkeyLoginVerify: () => { POST: RequestHandler }
	mfaStatus: () => { GET: RequestHandler }
	mfaEnroll: () => { POST: RequestHandler }
	mfaVerify: () => { POST: RequestHandler }
	mfaDisable: () => { POST: RequestHandler }
	mfaBackupCode: () => { POST: RequestHandler }
	sessions: () => { GET: RequestHandler; POST: RequestHandler }
}

/** Defines session list response options for wiring providers, adapters, cookies, hooks, and route handlers. */
export type SessionListResponse = {
	ok: boolean
	sessions: SessionSummary[]
}
