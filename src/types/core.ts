/** Auth session persisted by a session adapter. */
export type Session = {
	id: string;
	userId: string;
	expiresAt: Date;
	fresh?: boolean;
	createdAt?: Date;
	lastActiveAt?: Date | null;
	ip?: string | null;
	userAgent?: string | null;
	fingerprint?: string | null;
};

/** Optional metadata captured when creating a session. */
export type SessionMetadata = {
	rememberMe?: boolean;
	ip?: string;
	userAgent?: string;
	fingerprint?: string;
};

/** Public authenticated user shape returned by adapters and session validation. */
export type User = {
	id: string;
	email: string;
	name: string;
	avatar: string | null;
	emailVerified: boolean;
	role?: string;
	settings?: Record<string, unknown>;
	createdAt?: Date;
	updatedAt?: Date;
};

/** OAuth token set stored by OAuth token adapters. */
export type OAuthTokens = {
	accessToken: string;
	refreshToken: string | null;
	scope: string | null;
	accessTokenExpiresAt: string;
};

/** Normalized OAuth profile returned by providers. */
export type OAuthProfile = {
	id: string;
	email: string;
	name?: string;
	picture?: string;
	verified_email?: boolean;
};

/** Verification token record for email verification and password reset flows. */
export type VerificationToken = {
	id: string;
	userId: string;
	type: string;
	token: string;
	expiresAt: Date;
	createdAt: Date;
};

/** Built-in verification-token purpose names. */
export const VERIFICATION_TOKEN_TYPES = {
	EMAIL_VERIFICATION: "email_verification",
	PASSWORD_RESET: "password_reset",
	EMAIL_UPDATE: "email_update",
};

/** Magic-link token record. */
export type MagicLinkToken = {
	id: string;
	userId: string | null;
	email: string;
	tokenHash: string;
	otpHash: string | null;
	expiresAt: Date;
	createdAt: Date;
};

/** Stored WebAuthn credential record. */
export type WebAuthnCredential = {
	id: string;
	userId: string;
	credentialId: string;
	publicKey: string;
	counter: number;
	transports: string[] | null;
	name: string | null;
	createdAt: Date;
	updatedAt: Date;
};

/** Session summary returned by session-management endpoints. */
export type SessionSummary = {
	id: string;
	userId: string;
	expiresAt: Date;
	createdAt?: Date | null;
	lastActiveAt?: Date | null;
	ip?: string | null;
	userAgent?: string | null;
	current?: boolean;
};
