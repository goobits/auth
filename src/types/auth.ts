import type { Cookies, RequestEvent, RequestHandler } from "@sveltejs/kit";
import type { OAuthProvider } from "../providers/base.js";
import type {
	OAuthProfile,
	OAuthTokens,
	Session,
	SessionSummary,
	User,
} from "./core.js";
import type { SessionAdapter } from "../adapters/session/base.js";
import type { UserAdapter } from "../adapters/database/base.js";
import type { TokenAdapter } from "../adapters/oauth-token/base.js";
import type { MagicLinkAdapter } from "../adapters/magic-link/base.js";
import type { WebAuthnAdapter } from "../adapters/webauthn/base.js";
import type { VerificationTokenAdapter } from "../adapters/verification-token/base.js";
import type { Logger } from "../utils/logger.js";
import type { AuthEventEmitter } from "../security/events.js";
import type { SecurityAlertHandler } from "../security/alerts.js";

export type AuthLocals = {
	user?: User | null;
	session?: Session | null;
};

export type RequestEventLike = Pick<
	RequestEvent,
	"request" | "cookies" | "params" | "locals" | "url"
> & {
	params: Record<string, string>;
	locals: AuthLocals;
	getClientAddress?: () => string;
};

export type OAuthProviderConfig = {
	provider: OAuthProvider;
	scopes?: string[];
};

export type AuthUrls = {
	login?: string;
	afterLogin?: string;
	afterLogout?: string;
};

export type AuthCookiesConfig = {
	secure?: boolean;
};

export type AuthLoginResult = { userId: string | number } | void;
export type OnLoginMode = "augment" | "manual";

export type AuthHooks = {
	onSessionValidated?: (
		event: RequestEventLike,
		session: Session,
		user: User,
	) => Promise<void> | void;
	onLogin?: (
		event: RequestEventLike,
		profile: OAuthProfile,
		tokens: OAuthTokens | null,
		user?: User | null,
	) => Promise<AuthLoginResult> | AuthLoginResult;
	// "augment" keeps framework-managed session creation (default).
	// "manual" lets advanced callers fully manage session creation.
	onLoginMode?: OnLoginMode;
	onLogout?: (event: RequestEventLike) => Promise<void> | void;
	onError?: (event: RequestEventLike, error: unknown) => Promise<void> | void;
};

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
		onLogin?: AuthHooks["onLogin"];
		getMetadata?: (event: RequestEventLike) => Promise<Record<string, unknown>>;
		createUser?: (email: string, event: RequestEventLike) => Promise<User>;
		sanitizeUser?: (user: User | null) => User | null;
	};
};

export type WebAuthnConfig = {
	origin?: string;
	rpID?: string;
	rpName?: string;
	timeoutMs?: number;
	attestation?: "none" | "indirect" | "direct" | "enterprise";
	userVerification?: "required" | "preferred" | "discouraged";
	credentialName?: string;
	hooks?: {
		onLogin?: AuthHooks["onLogin"];
	};
};

export type SessionsConfig = {
	listLimit?: number;
};

export type SecurityProfile = "basic" | "secure" | "strict";
export type SecurityMode = "required" | "optional" | "off";

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
};

type BaseAuthAdapters = {
	session: SessionAdapter;
	user?: UserAdapter;
	oauthToken?: TokenAdapter;
	verificationToken?: VerificationTokenAdapter;
	magicLink?: MagicLinkAdapter;
	webauthn?: WebAuthnAdapter;
};

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
};

type AuthConfigNoFeatures = CommonAuthConfigFields & {
	adapters: BaseAuthAdapters;
	magicLink?: undefined;
	webauthn?: undefined;
};

type AuthConfigWithMagicLink = CommonAuthConfigFields & {
	adapters: BaseAuthAdapters & { magicLink: MagicLinkAdapter };
	magicLink: MagicLinkConfig;
	webauthn?: undefined;
};

type AuthConfigWithWebAuthn = CommonAuthConfigFields & {
	adapters: BaseAuthAdapters & { webauthn: WebAuthnAdapter };
	magicLink?: undefined;
	webauthn: WebAuthnConfig;
};

type AuthConfigWithBoth = CommonAuthConfigFields & {
	adapters: BaseAuthAdapters & {
		magicLink: MagicLinkAdapter;
		webauthn: WebAuthnAdapter;
	};
	magicLink: MagicLinkConfig;
	webauthn: WebAuthnConfig;
};

export type AuthConfig =
	| AuthConfigNoFeatures
	| AuthConfigWithMagicLink
	| AuthConfigWithWebAuthn
	| AuthConfigWithBoth;

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
};

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
};

export type SessionListResponse = {
	ok: boolean;
	sessions: SessionSummary[];
};
