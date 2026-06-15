import type { Cookies, RequestEvent, RequestHandler } from '@sveltejs/kit'

import type { UserAdapter } from '../adapters/database/UserAdapter.js'
import type { MagicLinkAdapter } from '../adapters/magic-link/MagicLinkAdapter.js'
import type { MfaAdapter } from '../adapters/mfa/MfaAdapter.js'
import type { TokenAdapter } from '../adapters/oauth-token/TokenAdapter.js'
import type { SessionAdapter } from '../adapters/session/SessionAdapter.js'
import type { VerificationTokenAdapter } from '../adapters/verification-token/VerificationTokenAdapter.js'
import type { WebAuthnAdapter } from '../adapters/webauthn/WebAuthnAdapter.js'
import type { OAuthProvider } from '../providers/OAuthProvider.js'
import type { WebhookChannelOptions } from '@goobits/security/alerting'
import type { SecurityAlertHandler } from '../security/alerts.js'
import type { AuthEventEmitter } from '../security/events.js'
import type { RateLimitStore } from '@goobits/security/rate-limit'
import type { Logger } from '../utils/logger.js'
import type {
	OAuthProfile,
	OAuthTokens,
	Session,
	SessionSummary,
	User
} from './core.js'

export type AuthLocals = {
	user?: User | null;
	session?: Session | null;
}

export type RequestEventLike = Pick<
	RequestEvent,
	'request' | 'cookies' | 'params' | 'locals' | 'url'
> & {
	params: Record<string, string>;
	locals: AuthLocals;
	getClientAddress?: () => string;
}

export type OAuthProviderConfig = {
	provider: OAuthProvider;
	scopes?: string[];
}

export type AuthUrls = {
	login?: string;
	afterLogin?: string;
	afterLogout?: string;
}

export type AuthCookiesConfig = {
	secure?: boolean;
}

export type AuthLoginResult = { userId: string | number } | void
export type OnLoginMode = 'augment' | 'manual'

export type AuthHooks = {
	onSessionValidated?: (
		event: RequestEventLike,
		session: Session,
		user: User
	) => Promise<void> | void;
	onLogin?: (
		event: RequestEventLike,
		profile: OAuthProfile,
		tokens: OAuthTokens | null,
		user?: User | null
	) => Promise<AuthLoginResult> | AuthLoginResult;

	// "augment" keeps framework-managed session creation (default).
	// "manual" lets advanced callers fully manage session creation.
	onLoginMode?: OnLoginMode;
	onLogout?: (event: RequestEventLike) => Promise<void> | void;
	onError?: (event: RequestEventLike, error: unknown) => Promise<void> | void;
}

export type MagicLinkConfig = {
	send: {
		email: (payload: {
			email: string;
			link: string;
			otp: string | null;
			token: string;
			expiresAt: Date;
			user: User | null;
			redirectTo: string;
			secureCookies: boolean;
		}) => Promise<void> | void;
	};
	settings?: {
		allowSignup?: boolean;
		expiresInMs?: number;
		magicLinkPath?: string;
		includeOtp?: boolean;
		otpDigits?: number;
		singleUsePerEmail?: boolean;
		secureCookies?: boolean;
		normalizeEmail?: (email: string) => string;
		exposeToken?: boolean;
		baseUrl?: string;
		trustProxyHeader?: boolean;
		key?: (event: RequestEventLike) => string;
	};
	limits?: {
		request?: (event: RequestEventLike) => Promise<void> | void;
		verify?: (key: string) => Promise<{ allowed: boolean }>;
		verifyMax?: number;
		verifyWindowMs?: number;
	};
	hooks?: {
		onLogin?: AuthHooks['onLogin'];
		getMetadata?: (event: RequestEventLike) => Promise<Record<string, unknown>>;
		createUser?: (email: string, event: RequestEventLike) => Promise<User>;
		sanitizeUser?: (user: User | null) => User | null;
	};
}

export type WebAuthnConfig = {
	origin?: string;
	rpID?: string;
	rpName?: string;
	timeoutMs?: number;
	attestation?: 'none' | 'indirect' | 'direct' | 'enterprise';
	userVerification?: 'required' | 'preferred' | 'discouraged';
	credentialName?: string;
	hooks?: {
		onLogin?: AuthHooks['onLogin'];
	};
}

export type TotpMfaConfig = {
	issuer?: string;
	label?: (userId: string, locals: RequestEventLike['locals']) => string;
}

export type SessionsConfig = {
	listLimit?: number;
}

export type SecurityProfile = 'basic' | 'secure' | 'strict'
export type SecurityMode = 'required' | 'optional' | 'off'
export type TrustedProxyHeader = 'cf-connecting-ip' | 'x-forwarded-for'
export type AuthAlertWebhookConfig = Omit<WebhookChannelOptions, 'url'> & {
	url?: string | null;
}

export type AuthSecurityConfig = {
	csrf?: {
		mode?: SecurityMode;
		cookieName?: string;
		headerName?: string;
		checkExpiry?: boolean;
		httpOnly?: boolean;
	};
	rateLimit?: {
		mode?: SecurityMode;
		max?: number;
		windowMs?: number;
		keyPrefix?: string;
		trustProxyHeader?: boolean;
		trustedProxyHeaders?: TrustedProxyHeader[];
		store?: RateLimitStore;
	};
	audit?: {
		mode?: SecurityMode;
		emitter?: AuthEventEmitter;
	};
	alerts?: {
		enabled?: boolean;
		onAlert?: SecurityAlertHandler;
		webhook?: AuthAlertWebhookConfig;
	};
}

type BaseAuthAdapters = {
	session: SessionAdapter;
	user?: UserAdapter;
	oauthToken?: TokenAdapter;
	verificationToken?: VerificationTokenAdapter;
	magicLink?: MagicLinkAdapter;
	mfa?: MfaAdapter;
	webauthn?: WebAuthnAdapter;
}

type CommonAuthConfigFields = {
	providers?: Record<string, OAuthProviderConfig>;
	urls?: AuthUrls;
	cookies?: AuthCookiesConfig;
	hooks?: AuthHooks;
	autoCreateSession?: boolean;
	requireVerifiedEmailForLinking?: boolean;
	isAuthenticated?: (locals: AuthLocals) => boolean;
	sanitizeUser?: (user: User | null) => User | null;
	profile?: SecurityProfile;
	security?: AuthSecurityConfig;
	sessions?: SessionsConfig;
	mfa?: TotpMfaConfig;
	logger?: Logger;
}

type AuthConfigNoFeatures = CommonAuthConfigFields & {
	adapters: BaseAuthAdapters;
	magicLink?: undefined;
	webauthn?: undefined;
}

type AuthConfigWithMagicLink = CommonAuthConfigFields & {
	adapters: BaseAuthAdapters & { magicLink: MagicLinkAdapter };
	magicLink: MagicLinkConfig;
	webauthn?: undefined;
}

type AuthConfigWithWebAuthn = CommonAuthConfigFields & {
	adapters: BaseAuthAdapters & { webauthn: WebAuthnAdapter };
	magicLink?: undefined;
	webauthn: WebAuthnConfig;
}

type AuthConfigWithBoth = CommonAuthConfigFields & {
	adapters: BaseAuthAdapters & {
		magicLink: MagicLinkAdapter;
		webauthn: WebAuthnAdapter;
	};
	magicLink: MagicLinkConfig;
	webauthn: WebAuthnConfig;
}

export type AuthConfig =
	| AuthConfigNoFeatures
	| AuthConfigWithMagicLink
	| AuthConfigWithWebAuthn
	| AuthConfigWithBoth

export type AuthHandlers = {
	login?: RequestHandler;
	callback?: RequestHandler;
	logout: RequestHandler;
	hooks: (input: { event: RequestEventLike; resolve: (e: RequestEventLike) => Promise<Response> }) => Promise<Response>;
	magicLink?: {
		request: RequestHandler;
		verify: RequestHandler;
	};
	webauthn?: {
		registerOptions: RequestHandler;
		registerVerify: RequestHandler;
		loginOptions: RequestHandler;
		loginVerify: RequestHandler;
	};
	mfa?: {
		status: RequestHandler;
		enroll: RequestHandler;
		verify: RequestHandler;
		disable: RequestHandler;
		backupCode: RequestHandler;
	};
	sessions?: {
		list: RequestHandler;
		revoke: RequestHandler;
	};
}

export type AuthRoutes = {
	login: () => { GET: RequestHandler };
	callback: () => { GET: RequestHandler };
	logout: () => { POST: RequestHandler };
	magicLink: () => { POST: RequestHandler };
	magicLinkVerify: () => { GET: RequestHandler; POST: RequestHandler };
	passkeyRegisterOptions: () => { POST: RequestHandler };
	passkeyRegisterVerify: () => { POST: RequestHandler };
	passkeyLoginOptions: () => { POST: RequestHandler };
	passkeyLoginVerify: () => { POST: RequestHandler };
	mfaStatus: () => { GET: RequestHandler };
	mfaEnroll: () => { POST: RequestHandler };
	mfaVerify: () => { POST: RequestHandler };
	mfaDisable: () => { POST: RequestHandler };
	mfaBackupCode: () => { POST: RequestHandler };
	sessions: () => { GET: RequestHandler; POST: RequestHandler };
}

export type SessionListResponse = {
	ok: boolean;
	sessions: SessionSummary[];
}
