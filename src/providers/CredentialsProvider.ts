import type { UserAdapter } from '../adapters/database/UserAdapter.ts'
import { hashPassword, verifyPassword } from '../password/index.ts'
import type { User } from '../types/core.ts'
import { getLogger } from '../utils/logger.ts'

type PasswordValidationResult = { valid: boolean; errors: string[] }
type ValidatePasswordFn = (password: string) => PasswordValidationResult
type NormalizeIdentifierFn = (value: string) => string
type HashPasswordFn = (password: string) => Promise<string>
export type PasswordVerificationResult = {
	valid: boolean
	needsRehash?: boolean
}
type VerifyPasswordFn = (
	storedHash: string,
	password: string
) => Promise<boolean | PasswordVerificationResult>

type CredentialsProviderOptions = {
	validatePassword?: ValidatePasswordFn
	identifierField?: string
	allowBoth?: boolean
	normalizeIdentifier?: NormalizeIdentifierFn
	hashPassword?: HashPasswordFn
	verifyPassword?: VerifyPasswordFn
}

/**
 * Credentials Provider for email/password authentication
 * Handles signup, signin, and password management
 */
export class CredentialsProvider {
	name: string
	validatePassword?: ValidatePasswordFn
	identifierField: string
	allowBoth: boolean
	normalizeIdentifier: NormalizeIdentifierFn
	hashPassword: HashPasswordFn
	verifyPassword: VerifyPasswordFn

	private validateNewPassword(password: string): void {
		if (!this.validatePassword) return
		const validation = this.validatePassword(password)
		if (!validation.valid) {
			throw new Error(validation.errors.join(', '))
		}
	}

	/** Validates and hashes a password without persisting it. */
	async createPasswordHash(password: string): Promise<string> {
		if (!password) throw new Error('Password is required')
		this.validateNewPassword(password)
		return await this.hashPassword(password)
	}

	/**
	 * @param {Object} [options] - Configuration options
	 * @param {Function} [options.validatePassword] - Custom password validation function
	 */
	constructor(options: CredentialsProviderOptions = {}) {
		this.name = 'credentials'
		if (options.validatePassword) this.validatePassword = options.validatePassword
		this.identifierField = options.identifierField ?? 'email'
		this.allowBoth = options.allowBoth ?? false
		this.normalizeIdentifier =
			options.normalizeIdentifier ?? ((value) => value.trim().toLowerCase())
		this.hashPassword = options.hashPassword ?? hashPassword
		this.verifyPassword = options.verifyPassword ?? verifyPassword
	}

	withIdentifier(
		identifierField: string,
		options: { allowBoth?: boolean; normalizeIdentifier?: NormalizeIdentifierFn } = {}
	) {
		const providerOptions: CredentialsProviderOptions = {
			identifierField,
			allowBoth: options.allowBoth ?? this.allowBoth,
			normalizeIdentifier: options.normalizeIdentifier ?? this.normalizeIdentifier,
			hashPassword: this.hashPassword,
			verifyPassword: this.verifyPassword
		}
		if (this.validatePassword) {
			providerOptions.validatePassword = this.validatePassword
		}
		return new CredentialsProvider(providerOptions)
	}

	/**
	 * Authenticate a user with email and password
	 *
	 * @param {string} params.email - User email
	 * @param identifier - identifier value.
	 * @param identifierField - identifier field value.
	 * @param allowBoth - allow both value.
	 * @param {string} params.password - Plain text password
	 * @param {import('../adapters/database/UserAdapter.ts').UserAdapter} params.userAdapter - User adapter
	 * @returns {Promise<{user: Object, valid: boolean}>}
	 */
	async authenticate({
		email,
		identifier,
		identifierField,
		allowBoth,
		password,
		userAdapter
	}: {
		email?: string
		identifier?: string
		identifierField?: string
		allowBoth?: boolean
		password: string
		userAdapter: UserAdapter
	}): Promise<{ user: User | null; valid: boolean }> {
		const rawIdentifier = identifier ?? email ?? ''
		if (!rawIdentifier || !password) {
			return { user: null, valid: false }
		}

		const resolvedField = identifierField ?? this.identifierField
		const resolvedAllowBoth = allowBoth ?? this.allowBoth
		const normalizedIdentifier = this.normalizeIdentifier(rawIdentifier)

		let user: (Record<string, unknown> & { password?: string | null }) | null = null
		let matchedField: string | null = null

		const tryFields = resolvedAllowBoth
			? Array.from(new Set([resolvedField, 'email']))
			: [resolvedField]

		for (const field of tryFields) {
			if (field === 'email') {
				user = await userAdapter.getUserWithPasswordHash(normalizedIdentifier)
			} else if (userAdapter.getUserWithPasswordHashByIdentifier) {
				user = await userAdapter.getUserWithPasswordHashByIdentifier(normalizedIdentifier, field)
			}

			if (user) {
				matchedField = field
				break
			}
		}

		if (!user || !user.password) {
			return { user: null, valid: false }
		}

		const verification = await this.verifyPassword(user.password, password)
		const valid = typeof verification === 'boolean' ? verification : verification.valid

		if (!valid) {
			return { user: null, valid: false }
		}

		if (typeof verification !== 'boolean' && verification.needsRehash) {
			const userId =
				typeof user['id'] === 'string' || typeof user['id'] === 'number' ? String(user['id']) : null
			if (userId) {
				try {
					const upgradedHash = await this.createPasswordHash(password)
					await userAdapter.updateUser(userId, { password: upgradedHash })
				} catch (error) {
					getLogger().error?.(
						'[CredentialsProvider] Failed to upgrade password hash:',
						error instanceof Error ? error.message : String(error)
					)
				}
			}
		}

		// Return sanitized user
		const sanitized =
			matchedField === 'email'
				? await userAdapter.getUserByEmail(normalizedIdentifier)
				: userAdapter.getUserByIdentifier
					? await userAdapter.getUserByIdentifier(
							normalizedIdentifier,
							matchedField ?? resolvedField
						)
					: await userAdapter.getUserByEmail(normalizedIdentifier)
		return { user: sanitized, valid: true }
	}

	/**
	 * Create a new user with email and password
	 *
	 * @param {string} params.email - User email
	 * @param {string} params.password - Plain text password
	 * @param {string} [params.name] - User name
	 * @param {Object} [params.metadata] - Additional user data
	 * @param {import('../adapters/database/UserAdapter.ts').UserAdapter} params.userAdapter - User adapter
	 * @returns {Promise<Object>} Created user (sanitized)
	 */
	async signUp({
		email,
		password,
		name,
		metadata = {},
		userAdapter
	}: {
		email: string
		password: string
		name?: string
		metadata?: Record<string, unknown>
		userAdapter: UserAdapter
	}): Promise<Record<string, unknown>> {
		if (!email || !password) {
			throw new Error('Email and password are required')
		}

		const passwordHash = await this.createPasswordHash(password)

		// Create user profile
		const profile: {
			id: string
			email: string
			name?: string
			verified_email: boolean
		} = {
			id: email.toLowerCase(),
			email: email.toLowerCase(),
			verified_email: false
		}
		const fallbackName = email.split('@')[0] ?? ''
		if (name) {
			profile.name = name
		} else if (fallbackName) {
			profile.name = fallbackName
		}

		// Create user with hashed password
		const user = await userAdapter.createUser(profile, {
			password: passwordHash,
			provider: 'email',
			emailVerified: false,
			...metadata
		})

		return user
	}

	/**
	 * Update user password
	 *
	 * @param {string} params.userId - User ID
	 * @param {string} params.newPassword - New plain text password
	 * @param {import('../adapters/database/UserAdapter.ts').UserAdapter} params.userAdapter - User adapter
	 * @returns {Promise<Object>} Updated user (sanitized)
	 */
	async updatePassword({
		userId,
		newPassword,
		userAdapter
	}: {
		userId: string
		newPassword: string
		userAdapter: UserAdapter
	}): Promise<Record<string, unknown>> {
		if (!userId || !newPassword) {
			throw new Error('User ID and new password are required')
		}

		const passwordHash = await this.createPasswordHash(newPassword)

		// Update user
		const user = await userAdapter.updateUser(userId, {
			password: passwordHash
		})

		return user
	}

	/**
	 * Verify current password before allowing update
	 *
	 * @param {string} params.email - User email
	 * @param {string} params.currentPassword - Current plain text password
	 * @param {string} params.newPassword - New plain text password
	 * @param {import('../adapters/database/UserAdapter.ts').UserAdapter} params.userAdapter - User adapter
	 * @returns {Promise<{user: Object, valid: boolean}>}
	 */
	async changePassword({
		email,
		currentPassword,
		newPassword,
		userAdapter
	}: {
		email: string
		currentPassword: string
		newPassword: string
		userAdapter: UserAdapter
	}): Promise<{ user: Record<string, unknown> | null; valid: boolean }> {
		// First verify current password
		const { user, valid } = await this.authenticate({
			email,
			password: currentPassword,
			userAdapter
		})

		if (!valid || !user) {
			return { user: null, valid: false }
		}

		// Update to new password
		const userId =
			typeof (user as { id?: unknown }).id === 'string' ||
			typeof (user as { id?: unknown }).id === 'number'
				? String((user as { id?: string | number }).id)
				: ''

		if (!userId) {
			return { user: null, valid: false }
		}

		const updatedUser = await this.updatePassword({
			userId,
			newPassword,
			userAdapter
		})

		return { user: updatedUser, valid: true }
	}
}
