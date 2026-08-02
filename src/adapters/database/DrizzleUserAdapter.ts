import { and, eq } from 'drizzle-orm'

import type { OAuthIdentity, OAuthProfile, User } from '../../types/index.ts'
import { toDrizzleUser as toUser } from '../_drizzleUser.ts'
import type { OAuthIdentityAdapter } from '../oauth-identity/OAuthIdentityAdapter.ts'
import { assertPublicUserData } from './publicUserData.ts'
import {
	type DrizzleDbLike,
	type DrizzleJson,
	type DrizzleRow,
	type DrizzleTable,
	requireCondition
} from '../drizzleTypes.ts'
import type { PasswordCredential, PasswordCredentialAdapter } from './PasswordCredentialAdapter.ts'
import { UserAdapter } from './UserAdapter.ts'

type UsersTable = DrizzleTable & {
	id: DrizzleTable[string]
	email: DrizzleTable[string]
	name: DrizzleTable[string]
	avatar?: DrizzleTable[string]
	emailVerified?: DrizzleTable[string]
	password?: DrizzleTable[string]
	passwordHash?: DrizzleTable[string]
}

type OAuthAccountsTable = DrizzleTable & {
	userId: DrizzleTable[string]
	provider: DrizzleTable[string]
	providerAccountId: DrizzleTable[string]
}

function toDrizzleRow(values: Record<string, DrizzleJson>): DrizzleRow {
	return values
}

/** Drizzle user adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class DrizzleUserAdapter
	extends UserAdapter
	implements PasswordCredentialAdapter, OAuthIdentityAdapter
{
	private db: DrizzleDbLike
	private usersTable: UsersTable
	private oauthAccountsTable: OAuthAccountsTable | null
	private sanitizeUser: (user: User | null) => User | null
	private passwordField: 'password' | 'passwordHash' | null

	constructor(
		db: DrizzleDbLike,
		options: {
			usersTable?: UsersTable
			oauthAccountsTable?: OAuthAccountsTable
			sanitizeUser?: (user: User | null) => User | null
		} = {}
	) {
		super()
		if (!options.usersTable) {
			throw new Error('DrizzleUserAdapter requires usersTable option')
		}
		this.db = db
		this.usersTable = options.usersTable
		this.oauthAccountsTable = options.oauthAccountsTable ?? null
		this.sanitizeUser = options.sanitizeUser ?? this._defaultSanitizeUser
		this.passwordField = this.usersTable.password
			? 'password'
			: this.usersTable.passwordHash
				? 'passwordHash'
				: null
	}

	_defaultSanitizeUser(user: User | null): User | null {
		return user
	}

	private async insertUser(
		profile: OAuthProfile,
		metadata: Record<string, unknown>,
		passwordHash?: string
	): Promise<User> {
		assertPublicUserData(metadata)
		const userData: Record<string, DrizzleJson> = {
			email: profile.email,
			name: profile.name ?? profile.email,
			avatar: profile.picture ?? null,
			emailVerified: Boolean(profile.verified_email)
		}
		for (const [key, value] of Object.entries(metadata)) {
			userData[key] = value as DrizzleJson
		}
		if (passwordHash !== undefined && this.passwordField) {
			userData[this.passwordField] = passwordHash
		}
		await this.db.insert(this.usersTable).values(toDrizzleRow(userData))
		const user = await this.getUserByEmail(profile.email)
		if (!user) throw new Error('Created user not found')
		return user
	}

	async createUser(profile: OAuthProfile, metadata: Record<string, unknown> = {}): Promise<User> {
		return this.insertUser(profile, metadata)
	}

	async createUserWithPassword(
		profile: OAuthProfile,
		passwordHash: string,
		metadata: Record<string, unknown> = {}
	): Promise<User> {
		if (!this.passwordField) throw new Error('Password column is not configured')
		if (!passwordHash) throw new Error('Password hash is required')
		return this.insertUser(profile, metadata, passwordHash)
	}

	async getUserById(id: string): Promise<User | null> {
		const [row] = await this.db.select().from(this.usersTable).where(eq(this.usersTable.id, id))
		return this.sanitizeUser(toUser(row ?? null))
	}

	async getUserByEmail(email: string): Promise<User | null> {
		const [row] = await this.db
			.select()
			.from(this.usersTable)
			.where(eq(this.usersTable.email, email))
		return this.sanitizeUser(toUser(row ?? null))
	}

	async getIdentity(provider: string, subject: string): Promise<OAuthIdentity | null> {
		if (!this.oauthAccountsTable) {
			throw new Error(
				'OAuth accounts table not configured. Set oauthAccountsTable in adapter options.'
			)
		}
		const [result] = await this.db
			.select()
			.from(this.oauthAccountsTable)
			.where(
				requireCondition(
					and(
						eq(this.oauthAccountsTable.provider, provider),
						eq(this.oauthAccountsTable.providerAccountId, subject)
					)
				)
			)
		const userId = result?.['userId']
		return typeof userId === 'string' ? { userId, provider, subject } : null
	}

	async updateUser(id: string, data: Partial<User> & Record<string, DrizzleJson>): Promise<User> {
		assertPublicUserData(data)
		if (Object.keys(data).length > 0) {
			await this.db
				.update(this.usersTable)
				.set(toDrizzleRow(data))
				.where(eq(this.usersTable.id, id))
		}
		const updated = await this.getUserById(id)
		if (!updated) throw new Error('Updated user not found')
		return updated
	}

	async deleteUser(id: string): Promise<void> {
		await this.db.delete(this.usersTable).where(eq(this.usersTable.id, id))
	}

	async listIdentities(userId: string): Promise<OAuthIdentity[]> {
		if (!this.oauthAccountsTable) {
			throw new Error(
				'OAuth accounts table not configured. Set oauthAccountsTable in adapter options.'
			)
		}
		const rows = await this.db
			.select()
			.from(this.oauthAccountsTable)
			.where(eq(this.oauthAccountsTable.userId, userId))
		return rows.flatMap((row) => {
			const provider = row['provider']
			const subject = row['providerAccountId']
			return typeof provider === 'string' && typeof subject === 'string'
				? [{ userId, provider, subject }]
				: []
		})
	}

	async linkIdentity({ userId, provider, subject }: OAuthIdentity): Promise<void> {
		if (!this.oauthAccountsTable) {
			throw new Error(
				'OAuth accounts table not configured. Set oauthAccountsTable in adapter options.'
			)
		}
		const existingForUser = (await this.listIdentities(userId)).find(
			(identity) => identity.provider === provider
		)
		if (existingForUser && existingForUser.subject !== subject) {
			throw new Error('OAuth provider is already linked to this user')
		}
		try {
			await this.db.insert(this.oauthAccountsTable).values({
				userId,
				provider,
				providerAccountId: subject
			})
		} catch (error) {
			const owner = await this.getIdentity(provider, subject)
			if (owner?.userId === userId) return
			throw error
		}
	}

	async unlinkIdentity(userId: string, provider: string): Promise<void> {
		if (!this.oauthAccountsTable) {
			throw new Error(
				'OAuth accounts table not configured. Set oauthAccountsTable in adapter options.'
			)
		}
		await this.db
			.delete(this.oauthAccountsTable)
			.where(
				requireCondition(
					and(
						eq(this.oauthAccountsTable.userId, userId),
						eq(this.oauthAccountsTable.provider, provider)
					)
				)
			)
	}

	async findPasswordCredential(
		identifier: string,
		field = 'email'
	): Promise<PasswordCredential | null> {
		if (field !== 'email') return null
		const [row] = await this.db
			.select()
			.from(this.usersTable)
			.where(eq(this.usersTable.email, identifier))
		if (!row) return null
		const user = toUser(row)
		if (!user) return null
		const password = this.passwordField ? row[this.passwordField] : null
		return {
			user: this.sanitizeUser(user) ?? user,
			passwordHash: typeof password === 'string' ? password : null
		}
	}

	async updatePasswordHash(userId: string, passwordHash: string): Promise<User> {
		if (!this.passwordField) throw new Error('Password column is not configured')
		if (!passwordHash) throw new Error('Password hash is required')
		await this.db
			.update(this.usersTable)
			.set({ [this.passwordField]: passwordHash })
			.where(eq(this.usersTable.id, userId))
		const updated = await this.getUserById(userId)
		if (!updated) throw new Error('Updated user not found')
		return updated
	}
}
