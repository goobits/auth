import type { OAuthProfile, User } from '../../types/index.ts'
import { generateRandomUUID } from '../../utils/crypto.ts'
import { normalizeEmail, recordValue, stringValue } from '../_inputValues.ts'
import type {
	PasswordCredential,
	PasswordCredentialAdapter
} from '../database/PasswordCredentialAdapter.ts'
import { UserAdapter } from '../database/UserAdapter.ts'
import { assertPublicUserData } from '../database/publicUserData.ts'

type StoredUser = User & { password?: string | null }

/** In-memory user adapter for local development and tests. */
export class MemoryUserAdapter extends UserAdapter implements PasswordCredentialAdapter {
	#oauthIndex = new Map<string, string>()
	#users = new Map<string, StoredUser>()

	private async insertUser(
		profile: OAuthProfile,
		metadata: Record<string, unknown>,
		passwordHash: string | null
	): Promise<User> {
		assertPublicUserData(metadata)
		const email = normalizeEmail(profile.email)
		const id =
			stringValue(metadata['id']) || stringValue(profile.id) || (await generateRandomUUID())
		const role = stringValue(metadata['role'])
		const user: StoredUser = {
			avatar: profile.picture ?? null,
			createdAt: new Date(),
			email,
			emailVerified: Boolean(profile.verified_email),
			id,
			name: stringValue(metadata['name']) || profile.name || email,
			password: passwordHash,
			settings: recordValue(metadata['settings']) ?? {},
			updatedAt: new Date()
		}
		if (role) {
			user.role = role
		}
		this.#users.set(id, user)
		return sanitizeUser(user) ?? user
	}

	async createUser(profile: OAuthProfile, metadata: Record<string, unknown> = {}): Promise<User> {
		return this.insertUser(profile, metadata, null)
	}

	async createUserWithPassword(
		profile: OAuthProfile,
		passwordHash: string,
		metadata: Record<string, unknown> = {}
	): Promise<User> {
		if (!passwordHash) throw new Error('Password hash is required')
		if (await this.getUserByEmail(profile.email)) {
			throw new Error('Unable to create user with those details')
		}
		return this.insertUser(profile, metadata, passwordHash)
	}

	async getUserById(id: string): Promise<User | null> {
		return sanitizeUser(this.#users.get(id) ?? null)
	}

	setUser(user: StoredUser): void {
		this.#users.set(user.id, user)
	}

	async getUserByEmail(email: string): Promise<User | null> {
		const normalized = normalizeEmail(email)
		for (const user of this.#users.values()) {
			if (user.email === normalized) {
				return sanitizeUser(user)
			}
		}
		return null
	}

	async getUserByProviderId(provider: string, providerId: string): Promise<User | null> {
		const userId = this.#oauthIndex.get(`${provider}:${providerId}`)
		return userId ? this.getUserById(userId) : null
	}

	async updateUser(id: string, data: Partial<User> & Record<string, unknown>): Promise<User> {
		assertPublicUserData(data)
		const existing = this.#users.get(id)
		if (!existing) {
			throw new Error('User not found')
		}
		const next = {
			...existing,
			...data,
			updatedAt: new Date()
		}
		this.#users.set(id, next)
		return sanitizeUser(next) ?? next
	}

	async deleteUser(id: string): Promise<void> {
		this.#users.delete(id)
	}

	async linkOAuthAccount(
		userId: string,
		provider: string,
		providerAccountId: string
	): Promise<void> {
		const key = `${provider}:${providerAccountId}`
		const owner = this.#oauthIndex.get(key)
		if (owner && owner !== userId) {
			throw new Error('OAuth provider account is already linked to another user')
		}
		this.#oauthIndex.set(key, userId)
	}

	async findPasswordCredential(
		identifier: string,
		field = 'email'
	): Promise<PasswordCredential | null> {
		if (field !== 'email') return null
		const normalized = normalizeEmail(identifier)
		for (const user of this.#users.values()) {
			if (user.email === normalized) {
				return {
					user: sanitizeUser(user) ?? user,
					passwordHash: user.password ?? null
				}
			}
		}
		return null
	}

	async updatePasswordHash(userId: string, passwordHash: string): Promise<User> {
		if (!passwordHash) throw new Error('Password hash is required')
		const existing = this.#users.get(userId)
		if (!existing) throw new Error('User not found')
		const next = { ...existing, password: passwordHash, updatedAt: new Date() }
		this.#users.set(userId, next)
		return sanitizeUser(next) ?? next
	}
}

function sanitizeUser(user: StoredUser | null): User | null {
	if (!user) {
		return null
	}
	const { password: _password, ...safeUser } = user
	return safeUser
}
