import type { OAuthProfile, User } from '../../types/index.ts'
import { assertPublicUserData } from '../database/publicUserData.ts'
import { generateRandomUUID } from '../../utils/crypto.ts'
import type {
	PasswordCredential,
	PasswordCredentialAdapter
} from '../database/PasswordCredentialAdapter.ts'
import { UserAdapter } from '../database/UserAdapter.ts'
import { normalizeEmail, recordValue, stringValue } from '../_inputValues.ts'
import { type PgPoolLike, requireRow } from './query.ts'

export type UserRow = {
	avatar: string | null
	created_at: Date
	email: string
	email_verified: boolean
	id: string
	name: string
	password: string | null
	role: string | null
	settings: Record<string, unknown>
	updated_at: Date
}

/** Postgres user adapter for sessions, users, tokens, MFA, magic links, or WebAuthn records. */
export class PgUserAdapter extends UserAdapter implements PasswordCredentialAdapter {
	#db: PgPoolLike

	constructor({ db }: { db: PgPoolLike }) {
		super()
		this.#db = db
	}

	private async insertUser(
		profile: OAuthProfile,
		metadata: Record<string, unknown>,
		passwordHash: string | null,
		conflictMessage: string
	): Promise<User> {
		const id = stringValue(metadata['id']) || (await generateRandomUUID())
		const email = normalizeEmail(profile.email)
		const name = stringValue(metadata['name']) || profile.name || email
		const row = (
			await this.#db.query<UserRow>(
				`
			INSERT INTO auth_users (id, email, name, avatar, email_verified, role, settings, password)
			VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
			ON CONFLICT (email) DO NOTHING
			RETURNING *
		`,
				[
					id,
					email,
					name,
					profile.picture ?? null,
					Boolean(profile.verified_email),
					stringValue(metadata['role']),
					JSON.stringify(recordValue(metadata['settings']) ?? {}),
					passwordHash
				]
			)
		).rows[0]
		if (!row) throw new Error(conflictMessage)
		return toUser(row)
	}

	async createUser(profile: OAuthProfile, metadata: Record<string, unknown> = {}): Promise<User> {
		assertPublicUserData(metadata)
		return this.insertUser(
			profile,
			metadata,
			null,
			'Unable to create OAuth user with those details'
		)
	}

	async createUserWithPassword(
		profile: OAuthProfile,
		passwordHash: string,
		metadata: Record<string, unknown> = {}
	): Promise<User> {
		assertPublicUserData(metadata)
		if (!passwordHash) throw new Error('Password hash is required')
		return this.insertUser(
			profile,
			metadata,
			passwordHash,
			'Unable to create user with those details'
		)
	}

	async getUserById(id: string): Promise<User | null> {
		const row = (await this.#db.query<UserRow>('SELECT * FROM auth_users WHERE id = $1', [id]))
			.rows[0]
		return row ? toUser(row) : null
	}

	async getUserByEmail(email: string): Promise<User | null> {
		const row = (
			await this.#db.query<UserRow>('SELECT * FROM auth_users WHERE email = $1', [
				normalizeEmail(email)
			])
		).rows[0]
		return row ? toUser(row) : null
	}

	async getUserByProviderId(provider: string, providerId: string): Promise<User | null> {
		const row = (
			await this.#db.query<UserRow>(
				`
			SELECT u.*
			FROM auth_users u
			JOIN auth_oauth_accounts a ON a.user_id = u.id
			WHERE a.provider = $1 AND a.provider_account_id = $2
		`,
				[provider, providerId]
			)
		).rows[0]
		return row ? toUser(row) : null
	}

	async updateUser(id: string, data: Partial<User> & Record<string, unknown>): Promise<User> {
		assertPublicUserData(data)
		const existing = await this.getUserById(id)
		if (!existing) {
			throw new Error('User not found')
		}
		const row = (
			await this.#db.query<UserRow>(
				`
			UPDATE auth_users
			SET email = $2,
				name = $3,
				avatar = $4,
				email_verified = $5,
				role = $6,
				settings = $7::jsonb,
				updated_at = now()
			WHERE id = $1
			RETURNING *
		`,
				[
					id,
					data.email ?? existing.email,
					data.name ?? existing.name,
					data.avatar ?? existing.avatar,
					data.emailVerified ?? existing.emailVerified,
					stringValue(data['role']),
					JSON.stringify(recordValue(data['settings']) ?? existing.settings ?? {})
				]
			)
		).rows[0]
		return toUser(requireRow(row))
	}

	async deleteUser(id: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_users WHERE id = $1', [id])
	}

	async linkOAuthAccount(
		userId: string,
		provider: string,
		providerAccountId: string
	): Promise<void> {
		const owner = (
			await this.#db.query<{ user_id: string }>(
				`
			INSERT INTO auth_oauth_accounts (provider, provider_account_id, user_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (provider, provider_account_id) DO UPDATE
				SET user_id = auth_oauth_accounts.user_id
			RETURNING user_id
		`,
				[provider, providerAccountId, userId]
			)
		).rows[0]?.user_id
		if (owner !== userId) {
			throw new Error('OAuth provider account is already linked to another user')
		}
	}

	async findPasswordCredential(
		identifier: string,
		field = 'email'
	): Promise<PasswordCredential | null> {
		if (field !== 'email') return null
		const row = (
			await this.#db.query<UserRow>('SELECT * FROM auth_users WHERE email = $1', [
				normalizeEmail(identifier)
			])
		).rows[0]
		return row ? { user: toUser(row), passwordHash: row.password } : null
	}

	async updatePasswordHash(userId: string, passwordHash: string): Promise<User> {
		if (!passwordHash) throw new Error('Password hash is required')
		const row = (
			await this.#db.query<UserRow>(
				'UPDATE auth_users SET password = $2, updated_at = now() WHERE id = $1 RETURNING *',
				[userId, passwordHash]
			)
		).rows[0]
		if (!row) throw new Error('User not found')
		return toUser(row)
	}
}

export function toUser(row: UserRow): User {
	const user: User = {
		avatar: row.avatar,
		createdAt: row.created_at,
		email: row.email,
		emailVerified: row.email_verified,
		id: row.id,
		name: row.name,
		settings: row.settings,
		updatedAt: row.updated_at
	}
	if (row.role) {
		user.role = row.role
	}
	return user
}
