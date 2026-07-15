import type {
	PasswordCredential,
	PasswordCredentialAdapter
} from '../adapters/database/PasswordCredentialAdapter.ts'
import { errorContext, resolveLogger, type Logger } from '../_internal/logger.ts'
import { omitSensitiveUserData } from '../_internal/publicUserData.ts'
import { hashPassword, verifyPassword } from '../password/index.ts'
import { assertPasswordInput, isPasswordWithinLimit } from '../password/policy.ts'
import type { User } from '../types/core.ts'

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

const DUMMY_PASSWORD_INPUT = 'goobits-auth-non-account-timing-sentinel-v1'

type CredentialsProviderOptions = {
	validatePassword?: ValidatePasswordFn
	identifierField?: string
	allowBoth?: boolean
	normalizeIdentifier?: NormalizeIdentifierFn
	hashPassword?: HashPasswordFn
	verifyPassword?: VerifyPasswordFn
	dummyPasswordHash?: string
	logger?: Logger
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
	dummyPasswordHash?: string
	private readonly logger: Logger
	private dummyPasswordHashPromise?: Promise<string>

	private async getDummyPasswordHash(): Promise<string> {
		if (this.dummyPasswordHash) return this.dummyPasswordHash
		this.dummyPasswordHashPromise ??= this.hashPassword(DUMMY_PASSWORD_INPUT)
		return await this.dummyPasswordHashPromise
	}

	private validateNewPassword(password: string): void {
		assertPasswordInput(password)
		if (!this.validatePassword) return
		const validation = this.validatePassword(password)
		if (!validation.valid) {
			throw new Error(validation.errors.join(', '))
		}
	}

	/** Validates and hashes a password without persisting it. */
	async createPasswordHash(password: string): Promise<string> {
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
		this.logger = resolveLogger(options.logger)
		if (options.dummyPasswordHash) this.dummyPasswordHash = options.dummyPasswordHash
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
			verifyPassword: this.verifyPassword,
			logger: this.logger
		}
		if (this.dummyPasswordHash) {
			providerOptions.dummyPasswordHash = this.dummyPasswordHash
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
	 * @param {PasswordCredentialAdapter} params.passwordCredentialAdapter - Secret-bearing credential adapter
	 * @returns {Promise<{user: Object, valid: boolean}>}
	 */
	async authenticate({
		email,
		identifier,
		identifierField,
		allowBoth,
		password,
		passwordCredentialAdapter
	}: {
		email?: string
		identifier?: string
		identifierField?: string
		allowBoth?: boolean
		password: string
		passwordCredentialAdapter: PasswordCredentialAdapter
	}): Promise<{ user: User | null; valid: boolean }> {
		const rawIdentifier = identifier ?? email ?? ''
		if (!rawIdentifier || !password || !isPasswordWithinLimit(password)) {
			return { user: null, valid: false }
		}

		const resolvedField = identifierField ?? this.identifierField
		const resolvedAllowBoth = allowBoth ?? this.allowBoth
		const normalizedIdentifier = this.normalizeIdentifier(rawIdentifier)

		let credential: PasswordCredential | null = null

		const tryFields = resolvedAllowBoth
			? Array.from(new Set([resolvedField, 'email']))
			: [resolvedField]

		for (const field of tryFields) {
			const candidate = await passwordCredentialAdapter.findPasswordCredential(
				normalizedIdentifier,
				field
			)
			credential ??= candidate
		}

		if (!credential?.passwordHash) {
			try {
				await this.verifyPassword(await this.getDummyPasswordHash(), password)
			} catch (error) {
				this.logger.error(
					'[CredentialsProvider] Dummy password verification failed',
					errorContext(error)
				)
			}
			return { user: null, valid: false }
		}

		const verification = await this.verifyPassword(credential.passwordHash, password)
		const valid = typeof verification === 'boolean' ? verification : verification.valid

		if (!valid) {
			return { user: null, valid: false }
		}

		if (typeof verification !== 'boolean' && verification.needsRehash) {
			try {
				const upgradedHash = await this.createPasswordHash(password)
				await passwordCredentialAdapter.updatePasswordHash(credential.user.id, upgradedHash)
			} catch (error) {
				this.logger.error(
					'[CredentialsProvider] Failed to upgrade password hash',
					errorContext(error)
				)
			}
		}

		return { user: credential.user, valid: true }
	}

	/**
	 * Create a new user with email and password
	 *
	 * @param {string} params.email - User email
	 * @param {string} params.password - Plain text password
	 * @param {string} [params.name] - User name
	 * @param {Object} [params.metadata] - Additional user data
	 * @param {PasswordCredentialAdapter} params.passwordCredentialAdapter - Secret-bearing credential adapter
	 * @returns {Promise<Object>} Created user (sanitized)
	 */
	async signUp({
		email,
		password,
		name,
		metadata = {},
		passwordCredentialAdapter
	}: {
		email: string
		password: string
		name?: string
		metadata?: Record<string, unknown>
		passwordCredentialAdapter: PasswordCredentialAdapter
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

		const safeMetadata = Object.fromEntries(
			Object.entries(omitSensitiveUserData(metadata)).filter(
				([key]) => key !== 'password' && key !== 'provider' && key !== 'emailVerified'
			)
		)

		// Create user with hashed password
		const user = await passwordCredentialAdapter.createUserWithPassword(profile, passwordHash, {
			...safeMetadata,
			provider: 'email',
			emailVerified: false
		})

		return user
	}

	/**
	 * Update user password
	 *
	 * @param {string} params.userId - User ID
	 * @param {string} params.newPassword - New plain text password
	 * @param {PasswordCredentialAdapter} params.passwordCredentialAdapter - Secret-bearing credential adapter
	 * @returns {Promise<Object>} Updated user (sanitized)
	 */
	async updatePassword({
		userId,
		newPassword,
		passwordCredentialAdapter
	}: {
		userId: string
		newPassword: string
		passwordCredentialAdapter: PasswordCredentialAdapter
	}): Promise<Record<string, unknown>> {
		if (!userId || !newPassword) {
			throw new Error('User ID and new password are required')
		}

		const passwordHash = await this.createPasswordHash(newPassword)

		// Update user
		const user = await passwordCredentialAdapter.updatePasswordHash(userId, passwordHash)

		return user
	}

	/**
	 * Verify current password before allowing update
	 *
	 * @param {string} params.email - User email
	 * @param {string} params.currentPassword - Current plain text password
	 * @param {string} params.newPassword - New plain text password
	 * @param {PasswordCredentialAdapter} params.passwordCredentialAdapter - Secret-bearing credential adapter
	 * @returns {Promise<{user: Object, valid: boolean}>}
	 */
	async changePassword({
		email,
		currentPassword,
		newPassword,
		passwordCredentialAdapter
	}: {
		email: string
		currentPassword: string
		newPassword: string
		passwordCredentialAdapter: PasswordCredentialAdapter
	}): Promise<{ user: Record<string, unknown> | null; valid: boolean }> {
		// First verify current password
		const { user, valid } = await this.authenticate({
			email,
			password: currentPassword,
			passwordCredentialAdapter
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
			passwordCredentialAdapter
		})

		return { user: updatedUser, valid: true }
	}
}
