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

export type SessionMetadata = {
	rememberMe?: boolean;
	ip?: string;
	userAgent?: string;
	fingerprint?: string;
};

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
	user_id?: number;
	nickname?: string;
	is_admin?: boolean;
	is_moderator?: boolean;
	u_posts?: number;
};

export type OAuthTokens = {
	accessToken: string;
	refreshToken: string | null;
	scope: string | null;
	accessTokenExpiresAt: string;
};

export type OAuthProfile = {
	id: string;
	email: string;
	name?: string;
	picture?: string;
	verified_email?: boolean;
};

export type VerificationToken = {
	id: string;
	userId: string;
	type: string;
	token: string;
	expiresAt: Date;
	createdAt: Date;
};

export const VERIFICATION_TOKEN_TYPES = {
	EMAIL_VERIFICATION: "email_verification",
	PASSWORD_RESET: "password_reset",
	EMAIL_UPDATE: "email_update",
};

export type MagicLinkToken = {
	id: string;
	userId: string | null;
	email: string;
	tokenHash: string;
	otpHash: string | null;
	expiresAt: Date;
	createdAt: Date;
};

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
