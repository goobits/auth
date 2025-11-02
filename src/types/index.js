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
