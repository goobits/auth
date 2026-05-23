import { randomBytes, randomUUID } from 'node:crypto'

import type { Cookies } from '@sveltejs/kit'

import type { OAuthProfile, Session, User } from '../../types/index.js'
import type { WebAuthnCredential } from '../../types/index.js'
import { UserAdapter } from '../database/base.js'
import { SessionAdapter } from '../session/base.js'
import { WebAuthnAdapter } from '../webauthn/base.js'

export type PgPoolLike = {
	query<T extends Record<string, unknown> = Record<string, unknown>>(
		text: string,
		values?: readonly unknown[],
	): Promise<{ rows: T[] }>;
}

type UserRow = {
	avatar: string | null;
	created_at: Date;
	email: string;
	email_verified: boolean;
	id: string;
	name: string;
	password: string | null;
	role: string | null;
	settings: Record<string, unknown>;
	updated_at: Date;
}

type SessionRow = {
	created_at: Date;
	expires_at: Date;
	fingerprint: string | null;
	id: string;
	ip: string | null;
	last_active_at: Date | null;
	user_agent: string | null;
	user_id: string;
}

type WebAuthnChallengeRow = {
	challenge: string;
	expires_at: Date;
	id: string;
	type: string;
	user_id: string | null;
}

type WebAuthnCredentialRow = {
	counter: number;
	created_at: Date;
	credential_id: string;
	name: string | null;
	public_key: string;
	transports: string[] | null;
	updated_at: Date;
	user_id: string;
}

export class PgUserAdapter extends UserAdapter {
	#db: PgPoolLike

	constructor({ db }: { db: PgPoolLike }) {
		super()
		this.#db = db
	}

	async createUser(profile: OAuthProfile, metadata: Record<string, unknown> = {}): Promise<User> {
		const id = stringValue(metadata['id']) || randomUUID()
		const email = normalizeEmail(profile.email)
		const name = stringValue(metadata['name']) || profile.name || email
		const password = stringValue(metadata['password'])
		const row = (
			await this.#db.query<UserRow>(
				`
			INSERT INTO auth_users (id, email, name, avatar, email_verified, role, settings, password)
			VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
			ON CONFLICT (email) DO UPDATE SET
				name = EXCLUDED.name,
				avatar = COALESCE(EXCLUDED.avatar, auth_users.avatar),
				email_verified = auth_users.email_verified OR EXCLUDED.email_verified,
				updated_at = now()
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
					password
				]
			)
		).rows[0]
		return toUser(requireRow(row))
	}

	async getUserById(id: string): Promise<User | null> {
		const row = (await this.#db.query<UserRow>('SELECT * FROM auth_users WHERE id = $1', [ id ])).rows[0]
		return row ? toUser(row) : null
	}

	async getUserByEmail(email: string): Promise<User | null> {
		const row = (await this.#db.query<UserRow>('SELECT * FROM auth_users WHERE email = $1', [ normalizeEmail(email) ])).rows[0]
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
				[ provider, providerId ]
			)
		).rows[0]
		return row ? toUser(row) : null
	}

	async updateUser(id: string, data: Partial<User> & Record<string, unknown>): Promise<User> {
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
		await this.#db.query('DELETE FROM auth_users WHERE id = $1', [ id ])
	}

	async linkOAuthAccount(userId: string, provider: string, providerAccountId: string): Promise<void> {
		await this.#db.query(
			`
			INSERT INTO auth_oauth_accounts (provider, provider_account_id, user_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (provider, provider_account_id) DO UPDATE SET user_id = EXCLUDED.user_id
		`,
			[ provider, providerAccountId, userId ]
		)
	}

	async getUserWithPasswordHash(email: string): Promise<(User & { password?: string | null }) | null> {
		const row = (await this.#db.query<UserRow>('SELECT * FROM auth_users WHERE email = $1', [ normalizeEmail(email) ])).rows[0]
		return row ? { ...toUser(row), password: row.password } : null
	}
}

export class PgSessionAdapter extends SessionAdapter {
	#cookieDomain: string | undefined
	#cookieName: string
	#db: PgPoolLike
	#secureCookies: boolean
	#sessionLifetimeMs: number

	constructor({
		cookieDomain,
		cookieName,
		db,
		secureCookies,
		sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000
	}: {
		cookieDomain?: string;
		cookieName: string;
		db: PgPoolLike;
		secureCookies: boolean;
		sessionLifetimeMs?: number;
	}) {
		super()
		this.#cookieDomain = cookieDomain
		this.#cookieName = cookieName
		this.#db = db
		this.#secureCookies = secureCookies
		this.#sessionLifetimeMs = sessionLifetimeMs
	}

	get cookieName(): string {
		return this.#cookieName
	}

	async createSession(userId: string, metadata: Record<string, unknown> = {}): Promise<Session> {
		const id = randomBytes(24).toString('base64url')
		const expiresAt = new Date(Date.now() + this.#sessionLifetimeMs)
		const row = (
			await this.#db.query<SessionRow>(
				`
			INSERT INTO auth_sessions (id, user_id, expires_at, ip, user_agent, fingerprint)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING *
		`,
				[
					id,
					userId,
					expiresAt,
					stringValue(metadata['ip']),
					stringValue(metadata['userAgent']),
					stringValue(metadata['fingerprint'])
				]
			)
		).rows[0]
		return toSession(requireRow(row))
	}

	async validateSession(sessionId: string): Promise<{ session: Session | null; user: User | null }> {
		const row = (
			await this.#db.query<SessionRow & UserRow & { user_created_at: Date; user_id_for_user: string }>(
				`
			SELECT
				s.id AS id,
				s.user_id,
				s.expires_at,
				s.created_at,
				s.last_active_at,
				s.ip,
				s.user_agent,
				s.fingerprint,
				u.id AS user_id_for_user,
				u.email,
				u.name,
				u.avatar,
				u.email_verified,
				u.role,
				u.settings,
				u.password,
				u.created_at AS user_created_at,
				u.updated_at
			FROM auth_sessions s
			JOIN auth_users u ON u.id = s.user_id
			WHERE s.id = $1
		`,
				[ sessionId ]
			)
		).rows[0]
		if (!row) {
			return { session: null, user: null }
		}
		if (row.expires_at.getTime() <= Date.now()) {
			await this.invalidateSession(sessionId)
			return { session: null, user: null }
		}
		await this.#db.query('UPDATE auth_sessions SET last_active_at = now() WHERE id = $1', [ sessionId ])
		return {
			session: toSession(row),
			user: toUser({
				...row,
				created_at: row.user_created_at,
				id: row.user_id_for_user
			})
		}
	}

	async invalidateSession(sessionId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_sessions WHERE id = $1', [ sessionId ])
	}

	async invalidateUserSessions(userId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_sessions WHERE user_id = $1', [ userId ])
	}

	async listSessions(userId: string): Promise<Session[]> {
		const rows = (
			await this.#db.query<SessionRow>(
				'SELECT * FROM auth_sessions WHERE user_id = $1 ORDER BY created_at DESC',
				[ userId ]
			)
		).rows
		return rows.map(toSession)
	}

	setSessionCookie(cookies: Cookies, session: Session): void {
		cookies.set(this.#cookieName, session.id, {
			...(this.#cookieDomain ? { domain: this.#cookieDomain } : {}),
			expires: session.expiresAt,
			httpOnly: true,
			path: '/',
			sameSite: 'lax',
			secure: this.#secureCookies
		})
	}

	deleteSessionCookie(cookies: Cookies): void {
		cookies.delete(this.#cookieName, {
			...(this.#cookieDomain ? { domain: this.#cookieDomain } : {}),
			path: '/'
		})
	}
}

export class PgWebAuthnAdapter extends WebAuthnAdapter {
	#db: PgPoolLike

	constructor({ db }: { db: PgPoolLike }) {
		super()
		this.#db = db
	}

	async createChallenge({
		challengeId,
		userId,
		challenge,
		type,
		expiresAt
	}: {
		challengeId: string;
		userId?: string | null;
		challenge: string;
		type: string;
		expiresAt: Date;
	}): Promise<void> {
		await this.#db.query(
			`
			INSERT INTO auth_webauthn_challenges (id, user_id, challenge, type, expires_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO UPDATE SET
				user_id = EXCLUDED.user_id,
				challenge = EXCLUDED.challenge,
				type = EXCLUDED.type,
				expires_at = EXCLUDED.expires_at
		`,
			[ challengeId, userId ?? null, challenge, type, expiresAt ]
		)
	}

	async getChallenge(challengeId: string): Promise<Record<string, unknown> | null> {
		const row = (
			await this.#db.query<WebAuthnChallengeRow>(
				'SELECT * FROM auth_webauthn_challenges WHERE id = $1',
				[ challengeId ]
			)
		).rows[0]
		return row ? toWebAuthnChallenge(row) : null
	}

	async deleteChallenge(challengeId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_webauthn_challenges WHERE id = $1', [
			challengeId
		])
	}

	async createCredential({
		userId,
		credentialId,
		publicKey,
		counter,
		transports,
		name
	}: {
		userId: string;
		credentialId: string;
		publicKey: string;
		counter: number;
		transports?: string[] | null;
		name?: string | null;
	}): Promise<void> {
		await this.#db.query(
			`
			INSERT INTO auth_webauthn_credentials
				(user_id, credential_id, public_key, counter, transports, name)
			VALUES ($1, $2, $3, $4, $5::jsonb, $6)
			ON CONFLICT (credential_id) DO UPDATE SET
				user_id = EXCLUDED.user_id,
				public_key = EXCLUDED.public_key,
				counter = EXCLUDED.counter,
				transports = EXCLUDED.transports,
				name = EXCLUDED.name,
				updated_at = now()
		`,
			[
				userId,
				credentialId,
				publicKey,
				counter,
				JSON.stringify(transports ?? null),
				name ?? null
			]
		)
	}

	async getCredential(credentialId: string): Promise<WebAuthnCredential | null> {
		const row = (
			await this.#db.query<WebAuthnCredentialRow>(
				'SELECT * FROM auth_webauthn_credentials WHERE credential_id = $1',
				[ credentialId ]
			)
		).rows[0]
		return row ? toWebAuthnCredential(row) : null
	}

	async listCredentials(userId: string): Promise<WebAuthnCredential[]> {
		const rows = (
			await this.#db.query<WebAuthnCredentialRow>(
				'SELECT * FROM auth_webauthn_credentials WHERE user_id = $1 ORDER BY created_at DESC',
				[ userId ]
			)
		).rows
		return rows.map(toWebAuthnCredential)
	}

	async updateCredential(
		credentialId: string,
		updates: Record<string, unknown>
	): Promise<void> {
		const allowed = new Map([
			['counter', updates['counter']],
			['name', updates['name']],
			['transports', updates['transports']]
		])
		const fields: string[] = []
		const values: unknown[] = []
		for (const [key, value] of allowed.entries()) {
			if (value === undefined) continue
			if (key === 'counter' && typeof value !== 'number') continue
			if (key === 'name' && value !== null && typeof value !== 'string') continue
			if (key === 'transports') {
				if (value !== null && (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string'))) {
					continue
				}
				fields.push(`transports = $${fields.length + 1}::jsonb`)
				values.push(JSON.stringify(value))
				continue
			}
			fields.push(`${ key } = $${fields.length + 1}`)
			values.push(value)
		}
		if (fields.length === 0) {
			return
		}
		values.push(credentialId)
		await this.#db.query(
			`
			UPDATE auth_webauthn_credentials
			SET ${ fields.join(', ') }, updated_at = now()
			WHERE credential_id = $${ values.length }
		`,
			values
		)
	}

	async deleteCredential(credentialId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_webauthn_credentials WHERE credential_id = $1', [
			credentialId
		])
	}

	async deleteUserCredentials(userId: string): Promise<void> {
		await this.#db.query('DELETE FROM auth_webauthn_credentials WHERE user_id = $1', [
			userId
		])
	}
}

export function createPgAuthAdapters(input: {
	cookieDomain?: string;
	cookieName: string;
	db: PgPoolLike;
	secureCookies: boolean;
}) {
	return {
		session: new PgSessionAdapter(input),
		user: new PgUserAdapter({ db: input.db }),
		webauthn: new PgWebAuthnAdapter({ db: input.db })
	}
}

export const pgAuthSchemaSql = `
CREATE TABLE IF NOT EXISTS auth_users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	avatar TEXT,
	email_verified BOOLEAN NOT NULL DEFAULT FALSE,
	role TEXT,
	settings JSONB NOT NULL DEFAULT '{}'::jsonb,
	password TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_oauth_accounts (
	provider TEXT NOT NULL,
	provider_account_id TEXT NOT NULL,
	user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS auth_oauth_accounts_user_id_idx ON auth_oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	last_active_at TIMESTAMPTZ,
	ip TEXT,
	user_agent TEXT,
	fingerprint TEXT
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_webauthn_challenges (
	id TEXT PRIMARY KEY,
	user_id TEXT REFERENCES auth_users(id) ON DELETE CASCADE,
	challenge TEXT NOT NULL,
	type TEXT NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_webauthn_challenges_expires_at_idx ON auth_webauthn_challenges(expires_at);
CREATE INDEX IF NOT EXISTS auth_webauthn_challenges_user_id_idx ON auth_webauthn_challenges(user_id);

CREATE TABLE IF NOT EXISTS auth_webauthn_credentials (
	credential_id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
	public_key TEXT NOT NULL,
	counter INTEGER NOT NULL DEFAULT 0,
	transports JSONB,
	name TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_webauthn_credentials_user_id_idx ON auth_webauthn_credentials(user_id);
`

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase()
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function toSession(row: SessionRow): Session {
	return {
		createdAt: row.created_at,
		expiresAt: row.expires_at,
		fingerprint: row.fingerprint,
		id: row.id,
		ip: row.ip,
		lastActiveAt: row.last_active_at,
		userAgent: row.user_agent,
		userId: row.user_id
	}
}

function toUser(row: UserRow): User {
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

function toWebAuthnChallenge(row: WebAuthnChallengeRow): Record<string, unknown> {
	return {
		challenge: row.challenge,
		expiresAt: row.expires_at,
		id: row.id,
		type: row.type,
		userId: row.user_id
	}
}

function toWebAuthnCredential(row: WebAuthnCredentialRow): WebAuthnCredential {
	return {
		counter: row.counter,
		createdAt: row.created_at,
		credentialId: row.credential_id,
		id: row.credential_id,
		name: row.name,
		publicKey: row.public_key,
		transports: Array.isArray(row.transports) ? row.transports : null,
		updatedAt: row.updated_at,
		userId: row.user_id
	}
}

function requireRow<T>(row: T | undefined): T {
	if (!row) {
		throw new Error('Expected database row')
	}
	return row
}
