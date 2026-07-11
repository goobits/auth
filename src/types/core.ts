/** Describes the auth domain record used for session. */
export type Session = {
	id: string;
	/** Non-secret handle for listing and revoking a persisted session. */
	managementId?: string;
	userId: string;
	expiresAt: Date;
	/** Replace the request cookie with `id`; concurrent refreshes must return the same value. */
	fresh?: boolean;
	createdAt?: Date;
	lastActiveAt?: Date | null;
	ip?: string | null;
	userAgent?: string | null;
	fingerprint?: string | null;
}

/** Describes the auth domain record used for session metadata. */
export type SessionMetadata = {
	rememberMe?: boolean;
	ip?: string;
	userAgent?: string;
	fingerprint?: string;
}

/** Describes the auth domain record used for user. */
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
}

/** Describes the auth domain record used for oauth tokens. */
export type OAuthTokens = {
	accessToken: string;
	refreshToken: string | null;
	scope: string | null;
	accessTokenExpiresAt: string;
}

/** Describes the auth domain record used for oauth profile. */
export type OAuthProfile = {
	id: string;
	email: string;
	name?: string;
	picture?: string;
	verified_email?: boolean;
}

/** Describes the auth domain record used for verification token. */
export type VerificationToken = {
	id: string;
	userId: string;
	type: string;
	token: string;
	expiresAt: Date;
	createdAt: Date;
}

/** Describes the auth domain record used for verification token types. */
export const VERIFICATION_TOKEN_TYPES = {
	EMAIL_VERIFICATION: 'email_verification',
	PASSWORD_RESET: 'password_reset',
	EMAIL_UPDATE: 'email_update'
}

/** Describes the auth domain record used for magic link token. */
export type MagicLinkToken = {
	id: string;
	userId: string | null;
	email: string;
	tokenHash: string;
	otpHash: string | null;
	expiresAt: Date;
	createdAt: Date;
}

/** Describes the auth domain record used for web authn credential. */
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
}

/** Describes the auth domain record used for mfa status. */
export type MfaStatus = {
	enabled: boolean;
	enabledAt: Date | null;
	backupCodeCount: number;
}

/** Describes the auth domain record used for session summary. */
export type SessionSummary = {
	id: string;
	userId: string;
	expiresAt: Date;
	createdAt?: Date | null;
	lastActiveAt?: Date | null;
	ip?: string | null;
	userAgent?: string | null;
	current?: boolean;
}
