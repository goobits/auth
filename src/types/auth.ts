import type { Cookies, RequestEvent, RequestHandler, Actions } from "@sveltejs/kit";
import type { OAuthProvider } from "../providers/base.ts";
import type {
	OAuthProfile,
	OAuthTokens,
	Session,
	SessionSummary,
	User,
} from "./index.ts";
import type { SessionAdapter } from "../adapters/session/base.ts";
import type { DatabaseAdapter } from "../adapters/database/base.ts";
import type { TokenAdapter } from "../adapters/token/base.ts";
import type { MagicLinkAdapter } from "../adapters/magic-link/base.ts";
import type { WebAuthnAdapter } from "../adapters/webauthn/base.ts";
import type { VerificationTokenAdapter } from "../utils/tokens.ts";
import type { Logger } from "../utils/logger.ts";

export type AuthLocals = {
	user?: User | null;
	session?: Session | null;
};

export type RequestEventLike = Pick<
	RequestEvent,
	"request" | "cookies" | "params" | "locals" | "url"
> & {
	params: Record<string, string | undefined>;
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
	) => Promise<
		| {
				userId?: string | number;
				id?: string | number;
				user?: { id?: string | number };
		  }
		| void
	> | void;
	onLogout?: (event: RequestEventLike) => Promise<void> | void;
	onError?: (event: RequestEventLike, error: unknown) => Promise<void> | void;
};

export type MagicLinkConfig = {
	sendEmail: (payload: {
		email: string;
		link: string;
		otp: string | null;
		token: string;
		expiresAt: Date;
		user: User | null;
		redirectTo: string;
		secureCookies: boolean;
	}) => Promise<void> | void;
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
	rateLimit?: (event: RequestEventLike) => Promise<void> | void;
	getMetadata?: (event: RequestEventLike) => Promise<Record<string, unknown>>;
	onLogin?: AuthHooks["onLogin"];
	createUser?: (email: string, event: RequestEventLike) => Promise<User>;
	verifyRateLimit?: (key: string) => Promise<{ allowed: boolean }>;
	verifyRateLimitMax?: number;
	verifyRateLimitWindowMs?: number;
	sanitizeUser?: (user: User | null) => User | null;
	trustProxyHeader?: boolean;
	key?: (event: RequestEventLike) => string;
};

export type WebAuthnConfig = {
	origin?: string;
	rpID?: string;
	rpName?: string;
	timeoutMs?: number;
	attestation?: "none" | "indirect" | "direct" | "enterprise";
	userVerification?: "required" | "preferred" | "discouraged";
	credentialName?: string;
	onLogin?: AuthHooks["onLogin"];
};

export type SessionsConfig = {
	listLimit?: number;
};

export type AuthAdapters = {
	session: SessionAdapter;
	database?: DatabaseAdapter;
	token?: TokenAdapter;
	verificationTokens?: VerificationTokenAdapter;
	magicLink?: MagicLinkAdapter;
	webauthn?: WebAuthnAdapter;
};

export type AuthConfig = {
	adapters: AuthAdapters;
	providers?: Record<string, OAuthProviderConfig>;
	urls?: AuthUrls;
	cookies?: AuthCookiesConfig;
	hooks?: AuthHooks;
	autoCreateSession?: boolean;
	requireVerifiedEmailForLinking?: boolean;
	isAuthenticated?: (locals: AuthLocals) => boolean;
	magicLink?: MagicLinkConfig;
	webauthn?: WebAuthnConfig;
	sessions?: SessionsConfig;
	logger?: Logger;
};

export type AuthHandlers = {
	login?: RequestHandler;
	callback?: RequestHandler;
	logout: Actions;
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
