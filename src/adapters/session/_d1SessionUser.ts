import type { User } from '../../types/index.ts'
import type { D1Row } from '../_d1Port.ts'

export type D1UserColumns = {
	id: string
	email: string
	name: string
	avatar: string
	password: string
	emailVerified: string
	role: string
	settings: string
	createdAt: string
	updatedAt: string
}

const parseStoredDate = (value: unknown): Date | undefined => {
	if (typeof value === 'string') {
		const parsed = new Date(value)
		return Number.isNaN(parsed.getTime()) ? undefined : parsed
	}
	if (typeof value === 'number') {
		// sqlite `unixepoch()` defaults are seconds; accept milliseconds too.
		const parsed = new Date(value > 1e12 ? value : value * 1000)
		return Number.isNaN(parsed.getTime()) ? undefined : parsed
	}
	return undefined
}

export function mapD1SessionUser(row: D1Row, columns: D1UserColumns): User | null {
	const id = row[columns.id] ?? row['id']
	const email = row[columns.email] ?? row['email']
	const name = row[columns.name] ?? row['name']

	// Preserve explicit NULLs from the DB (for example avatar_url = null).
	const avatar = Object.prototype.hasOwnProperty.call(row, columns.avatar)
		? row[columns.avatar]
		: row['avatar']
	const emailVerified = row[columns.emailVerified] ?? row['email_verified']
	const role = row[columns.role] ?? row['role']
	const settings = row[columns.settings] ?? row['settings']
	const createdAt = row[columns.createdAt] ?? row['created_at']
	const updatedAt = row[columns.updatedAt] ?? row['updated_at']
	if (typeof id !== 'string' && typeof id !== 'number') return null
	if (typeof email !== 'string' || typeof name !== 'string') return null
	if (avatar !== null && typeof avatar !== 'string') return null
	if (typeof emailVerified !== 'boolean' && emailVerified !== 0 && emailVerified !== 1) return null
	if (role !== null && role !== undefined && typeof role !== 'string') return null
	if (settings !== null && settings !== undefined && typeof settings !== 'string') return null
	if (
		createdAt !== null &&
		createdAt !== undefined &&
		typeof createdAt !== 'string' &&
		typeof createdAt !== 'number'
	) {
		return null
	}
	if (
		updatedAt !== null &&
		updatedAt !== undefined &&
		typeof updatedAt !== 'string' &&
		typeof updatedAt !== 'number'
	) {
		return null
	}

	let parsedSettings: Record<string, unknown> | undefined
	if (typeof settings === 'string' && settings.trim().length > 0) {
		try {
			const decoded: unknown = JSON.parse(settings)
			if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
				parsedSettings = decoded as Record<string, unknown>
			}
		} catch {
			// Ignore invalid JSON.
		}
	}
	const createdAtDate = parseStoredDate(createdAt)
	const updatedAtDate = parseStoredDate(updatedAt)
	return {
		id: String(id),
		email,
		name,
		avatar,
		emailVerified: Boolean(emailVerified),
		...(typeof role === 'string' ? { role } : {}),
		...(parsedSettings ? { settings: parsedSettings } : {}),
		...(createdAtDate ? { createdAt: createdAtDate } : {}),
		...(updatedAtDate ? { updatedAt: updatedAtDate } : {})
	}
}
