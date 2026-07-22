import type { User } from '../types/index.ts'
import type { DrizzleRow } from './drizzleTypes.ts'

/** Maps the common Drizzle auth-user projection without exposing adapter-specific fields. */
export function toDrizzleUser(row: DrizzleRow | null): User | null {
	if (!row) return null
	const id = row['id']
	const email = row['email']
	const name = row['name']
	const avatar = row['avatar'] ?? null
	const emailVerified = row['emailVerified'] ?? row['email_verified'] ?? false
	if (typeof id !== 'string' && typeof id !== 'number') return null
	if (typeof email !== 'string') return null
	if (typeof name !== 'string') return null
	if (avatar !== null && typeof avatar !== 'string') return null
	if (typeof emailVerified !== 'boolean' && emailVerified !== 0 && emailVerified !== 1) {
		return null
	}
	return {
		id: String(id),
		email,
		name,
		avatar,
		emailVerified: Boolean(emailVerified)
	}
}
