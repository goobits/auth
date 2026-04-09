import { randomUUID } from 'crypto'
import { pgTable, uuid, timestamp, text, serial } from 'drizzle-orm/pg-core'

export const drizzleUsersTable = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(),
	name: text('name'),
	passwordHash: text('password_hash'),
	createdAt: timestamp('created_at').defaultNow()
})

export const drizzleSessionsTable = pgTable('sessions', {
	id: text('id').primaryKey(),
	userId: uuid('user_id').notNull().references(() => drizzleUsersTable.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').defaultNow()
})

export const drizzleOauthTokensTable = pgTable('oauth_tokens', {
	id: serial('id').primaryKey(),
	userId: uuid('user_id').notNull().references(() => drizzleUsersTable.id, { onDelete: 'cascade' }),
	provider: text('provider').notNull(),
	tokens: text('tokens').notNull(),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow()
})

export function createMockDrizzleDb() {
	return {
		select: () => ({
			from: () => ({
				innerJoin: () => ({
					where: () => Promise.resolve([])
				}),
				where: () => Promise.resolve([])
			})
		}),
		insert: () => ({
			values: () => ({
				returning: () => Promise.resolve([{ id: 'session-123', userId: 'user-123', expiresAt: new Date() }])
			})
		}),
		delete: () => ({
			where: () => Promise.resolve()
		}),
		update: () => ({
			set: () => ({
				where: () => Promise.resolve()
			})
		})
	}
}

type IntegrationDbFixture = {
	db: any
	dispose: () => Promise<void>
}

export async function createIntegrationDrizzleFixture(): Promise<IntegrationDbFixture> {
	const connectionString = process.env.DATABASE_URL

	if (connectionString) {
		const { drizzle } = await import('drizzle-orm/postgres-js')
		const postgres = (await import('postgres')).default
		const client = postgres(connectionString, { max: 1 })
		const db = drizzle(client)

		await client`CREATE EXTENSION IF NOT EXISTS pgcrypto`
		await client`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email TEXT NOT NULL UNIQUE,
			name TEXT,
			password_hash TEXT,
			created_at TIMESTAMP DEFAULT now()
		)`
		await client`CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TIMESTAMP NOT NULL,
			created_at TIMESTAMP DEFAULT now()
		)`
		await client`CREATE TABLE IF NOT EXISTS oauth_tokens (
			id SERIAL PRIMARY KEY,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			provider TEXT NOT NULL,
			tokens TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT now(),
			updated_at TIMESTAMP DEFAULT now()
		)`

		return {
			db,
			dispose: async () => {
				await client.end({ timeout: 5 })
			}
		}
	}

	const { drizzle } = await import('drizzle-orm/pg-proxy')
	const { newDb } = await import('pg-mem')
	const dbMem = newDb()
	dbMem.public.registerFunction({
		name: 'gen_random_uuid',
		returns: 'uuid',
		implementation: () => randomUUID()
	})
	dbMem.public.none(`
		CREATE TABLE users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email TEXT NOT NULL UNIQUE,
			name TEXT,
			password_hash TEXT,
			created_at TIMESTAMP DEFAULT now()
		);
		CREATE TABLE sessions (
			id TEXT PRIMARY KEY,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TIMESTAMP NOT NULL,
			created_at TIMESTAMP DEFAULT now()
		);
		CREATE TABLE oauth_tokens (
			id SERIAL PRIMARY KEY,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			provider TEXT NOT NULL,
			tokens TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT now(),
			updated_at TIMESTAMP DEFAULT now()
		);
	`)

	const toLiteral = (value: unknown): string => {
		if (value === null || value === undefined) return 'null'
		if (value instanceof Date) return `'${value.toISOString()}'`
		if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
		if (typeof value === 'boolean') return value ? 'true' : 'false'
		if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
		if (Array.isArray(value)) return `ARRAY[${value.map((item) => toLiteral(item)).join(', ')}]`
		return `'${JSON.stringify(value).replace(/'/g, "''")}'`
	}

	const formatSql = (sql: string, params: unknown[]) => {
		let formatted = sql
		params.forEach((value, index) => {
			const literal = toLiteral(value)
			const pattern = new RegExp(`\\$${index + 1}(?!\\d)`, 'g')
			formatted = formatted.replace(pattern, literal)
		})
		return formatted
	}

	const db = drizzle(async (sql, params = []) => {
		const formatted = formatSql(sql, params)
		const result = dbMem.public.query(formatted)
		const rows = result.rows.map((row) => {
			const nameCounts: Record<string, number> = {}
			return result.fields.map((field) => {
				const baseName = field.name
				const index = nameCounts[baseName] ?? 0
				nameCounts[baseName] = index + 1
				const key = index === 0 ? baseName : `${baseName}${index}`
				return row[key]
			})
		})
		return { rows }
	})

	return {
		db,
		dispose: async () => {}
	}
}
