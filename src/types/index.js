/**
 * @typedef {Object} Session
 * @property {string} id - Session identifier
 * @property {string} userId - User ID
 * @property {Date} expiresAt - Expiration timestamp
 * @property {boolean} [fresh] - Whether session was just refreshed
 */

/**
 * @typedef {Object} User
 * @property {string} id - User ID
 * @property {string} email - Email address
 * @property {string} name - Display name
 * @property {string|null} avatar - Avatar URL
 * @property {boolean} emailVerified - Email verification status
 * @property {string} role - User role (e.g., 'USER', 'ADMIN')
 * @property {Object} settings - User settings object
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * // Note: password and token fields should NEVER be included
 */

/**
 * @typedef {Object} OAuthTokens
 * @property {string} accessToken - OAuth access token
 * @property {string} refreshToken - OAuth refresh token
 * @property {string} scope - OAuth scopes granted
 * @property {string} accessTokenExpiresAt - ISO timestamp of expiration
 */

/**
 * @typedef {Object} OAuthProfile
 * @property {string} id - Provider user ID
 * @property {string} email - Email address
 * @property {string} name - Display name
 * @property {string} [picture] - Profile picture URL
 * @property {boolean} [verified_email] - Email verification status
 */

/**
 * @typedef {Object} VerificationToken
 * @property {string} id - Token ID
 * @property {string} userId - User ID
 * @property {string} type - Token type ('email_verification' | 'password_reset' | 'email_update')
 * @property {string} token - Token value
 * @property {Date} expiresAt - Expiration timestamp
 * @property {Date} createdAt - Creation timestamp
 */

export const VERIFICATION_TOKEN_TYPES = {
	EMAIL_VERIFICATION: "email_verification",
	PASSWORD_RESET: "password_reset",
	EMAIL_UPDATE: "email_update",
};

/**
 * @typedef {Object} MagicLinkToken
 * @property {string} id - Token ID
 * @property {string|null} userId - User ID (optional for pre-signup)
 * @property {string} email - Email address
 * @property {string} tokenHash - Hashed token
 * @property {string|null} otpHash - Hashed OTP (optional)
 * @property {Date} expiresAt - Expiration timestamp
 * @property {Date} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} WebAuthnCredential
 * @property {string} id - Internal ID
 * @property {string} userId - User ID
 * @property {string} credentialId - WebAuthn credential ID (base64url)
 * @property {string} publicKey - Public key (base64url)
 * @property {number} counter - Signature counter
 * @property {string[]|null} transports - Transports
 * @property {string|null} name - Friendly name
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Updated timestamp
 */

/**
 * @typedef {Object} SessionSummary
 * @property {string} id - Session ID
 * @property {string} userId - User ID
 * @property {Date} expiresAt - Expiration timestamp
 * @property {Date|null} [createdAt] - Creation timestamp
 * @property {Date|null} [lastActiveAt] - Last active timestamp
 * @property {string|null} [ip] - IP address
 * @property {string|null} [userAgent] - User agent
 * @property {boolean} [current] - Whether this is the current session
 */
