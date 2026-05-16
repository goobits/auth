import type { RequestEvent, RequestHandler } from '@sveltejs/kit'

import type { UserAdapter } from '../adapters/database/base.js'
import type { MagicLinkAdapter } from '../adapters/magic-link/base.js'
import type { TokenAdapter } from '../adapters/oauth-token/base.js'
import type { SessionAdapter } from '../adapters/session/base.js'
import type { VerificationTokenAdapter } from '../adapters/verification-token/base.js'
import type { WebAuthnAdapter } from '../adapters/webauthn/base.js'
import type { OAuthProvider } from '../providers/base.js'
import type { SecurityAlertHandler } from '../security/alerts.js'
import type { AuthEventEmitter } from '../security/events.js'
import type { Logger } from '../utils/logger.js'
import type {
	OAuthProfile,
	OAuthTokens,
	Session,
	SessionSummary,
	User
} from './core.js'

/** Auth-related values stored on SvelteKit locals. */
export type AuthLocals = {
	user?: User | null;
	session?: Session | null;
}

/** Minimal SvelteKit request event shape consumed by auth handlers. */
export type RequestEventLike = Pick<
	RequestEvent,
	'request' | 'cookies' | 'params' | 'locals' | 'url'
> & {
	params: Record<string, string>;
	locals: AuthLocals;
	getClientAddress?: () => string;
}

/** OAuth provider registration used by the auth configuration. */
export type OAuthProviderConfig = {
	provider: OAuthProvider;
	scopes?: string[];
}

/** Redirect and allowed-origin settings for auth flows. */
export type AuthUrls = {
	allowedReturnToOrigins?: string[];
	login?: string;
	afterLogin?: string;
	afterLogout?: string;
}

/** Cookie defaults for auth-managed cookies. */
export type AuthCookiesConfig = {
	secure?: boolean;
}

/** Optional return value from login hooks to resolve a session user id. */
export type AuthLoginResult = { userId: string | number } | void
/** Session creation mode for login flows. */
export type OnLoginMode = 'augment' | 'manual'

/** Lifecycle hooks invoked by the auth engine. */
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

/** Magic-link feature configuration. */
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

/** WebAuthn/passkey feature configuration. */
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

/** Session-management endpoint configuration. */
export type SessionsConfig = {
	listLimit?: number;
}

/** Built-in security preset names. */
export type SecurityProfile = 'basic' | 'secure' | 'strict'
/** Per-control security enforcement mode. */
export type SecurityMode = 'required' | 'optional' | 'off'

/** CSRF, rate-limit, audit, and alert settings for auth handlers. */
export type AuthSecurityConfig = {
	csrf?: {
		mode?: SecurityMode;
		cookieName?: string;
		headerName?: string;
		checkExpiry?: boolean;
	};
	rateLimit?: {
		mode?: SecurityMode;
		max?: number;
		windowMs?: number;
		keyPrefix?: string;
		trustProxyHeader?: boolean;
	};
	audit?: {
		mode?: SecurityMode;
		emitter?: AuthEventEmitter;
	};
	alerts?: {
		enabled?: boolean;
		onAlert?: SecurityAlertHandler;
	};
}

type BaseAuthAdapters = {
	session: SessionAdapter;
	user?: UserAdapter;
	oauthToken?: TokenAdapter;
	verificationToken?: VerificationTokenAdapter;
	magicLink?: MagicLinkAdapter;
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

/** Complete auth engine configuration. */
export type AuthConfig =
	| AuthConfigNoFeatures
	| AuthConfigWithMagicLink
	| AuthConfigWithWebAuthn
	| AuthConfigWithBoth

/** Low-level route handlers assembled by the auth engine. */
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
	sessions?: {
		list: RequestHandler;
		revoke: RequestHandler;
	};
}

/** Route factories for apps that wire individual auth routes manually. */
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
	sessions: () => { GET: RequestHandler; POST: RequestHandler };
}

export type SessionListResponse = {
	ok: boolean;
	sessions: SessionSummary[];
}
