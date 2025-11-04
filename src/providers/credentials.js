import { hashPassword, verifyPassword } from "../utils/password.js";

/**
 * Credentials Provider for email/password authentication
 * Handles signup, signin, and password management
 */
export class CredentialsProvider {
	/**
	 * @param {Object} [options] - Configuration options
	 * @param {Function} [options.validatePassword] - Custom password validation function
	 */
	constructor(options = {}) {
		this.name = "credentials";
		this.validatePassword = options.validatePassword;
	}

	/**
	 * Authenticate a user with email and password
	 * @param {Object} params
	 * @param {string} params.email - User email
	 * @param {string} params.password - Plain text password
	 * @param {import('../adapters/database/base.js').DatabaseAdapter} params.userAdapter - User adapter
	 * @returns {Promise<{user: Object, valid: boolean}>}
	 */
	async authenticate({ email, password, userAdapter }) {
		if (!email || !password) {
			return { user: null, valid: false };
		}

		// Get user with password hash (using internal method)
		const user = await userAdapter._getUserWithPassword(email.toLowerCase());

		if (!user || !user.password) {
			return { user: null, valid: false };
		}

		// Verify password
		const valid = await verifyPassword(user.password, password);

		if (!valid) {
			return { user: null, valid: false };
		}

		// Return sanitized user
		const sanitized = await userAdapter.getUserByEmail(email);
		return { user: sanitized, valid: true };
	}

	/**
	 * Create a new user with email and password
	 * @param {Object} params
	 * @param {string} params.email - User email
	 * @param {string} params.password - Plain text password
	 * @param {string} [params.name] - User name
	 * @param {Object} [params.metadata] - Additional user data
	 * @param {import('../adapters/database/base.js').DatabaseAdapter} params.userAdapter - User adapter
	 * @returns {Promise<Object>} Created user (sanitized)
	 */
	async signUp({ email, password, name, metadata = {}, userAdapter }) {
		if (!email || !password) {
			throw new Error("Email and password are required");
		}

		// Validate password if custom validator provided
		if (this.validatePassword) {
			const validation = this.validatePassword(password);
			if (!validation.valid) {
				throw new Error(validation.errors.join(", "));
			}
		}

		// Hash password
		const passwordHash = await hashPassword(password);

		// Create user profile
		const profile = {
			email: email.toLowerCase(),
			name: name || email.split("@")[0],
			verified_email: false,
		};

		// Create user with hashed password
		const user = await userAdapter.createUser(profile, {
			password: passwordHash,
			provider: "email",
			emailVerified: false,
			...metadata,
		});

		return user;
	}

	/**
	 * Update user password
	 * @param {Object} params
	 * @param {string} params.userId - User ID
	 * @param {string} params.newPassword - New plain text password
	 * @param {import('../adapters/database/base.js').DatabaseAdapter} params.userAdapter - User adapter
	 * @returns {Promise<Object>} Updated user (sanitized)
	 */
	async updatePassword({ userId, newPassword, userAdapter }) {
		if (!userId || !newPassword) {
			throw new Error("User ID and new password are required");
		}

		// Validate password if custom validator provided
		if (this.validatePassword) {
			const validation = this.validatePassword(newPassword);
			if (!validation.valid) {
				throw new Error(validation.errors.join(", "));
			}
		}

		// Hash new password
		const passwordHash = await hashPassword(newPassword);

		// Update user
		const user = await userAdapter.updateUser(userId, {
			password: passwordHash,
		});

		return user;
	}

	/**
	 * Verify current password before allowing update
	 * @param {Object} params
	 * @param {string} params.email - User email
	 * @param {string} params.currentPassword - Current plain text password
	 * @param {string} params.newPassword - New plain text password
	 * @param {import('../adapters/database/base.js').DatabaseAdapter} params.userAdapter - User adapter
	 * @returns {Promise<{user: Object, valid: boolean}>}
	 */
	async changePassword({
		email,
		currentPassword,
		newPassword,
		userAdapter,
	}) {
		// First verify current password
		const { user, valid } = await this.authenticate({
			email,
			password: currentPassword,
			userAdapter,
		});

		if (!valid || !user) {
			return { user: null, valid: false };
		}

		// Update to new password
		const updatedUser = await this.updatePassword({
			userId: user.id,
			newPassword,
			userAdapter,
		});

		return { user: updatedUser, valid: true };
	}
}
