import { isSensitiveKey, omitSensitive } from '@goobits/security/redaction'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false
	const prototype = Object.getPrototypeOf(value)
	return prototype === Object.prototype || prototype === null
}

function findSensitiveField(value: unknown, seen = new WeakSet<object>()): string | null {
	if (!value || typeof value !== 'object') return null
	if (seen.has(value)) return null
	seen.add(value)

	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findSensitiveField(item, seen)
			if (found) return found
		}
		return null
	}
	if (!isPlainRecord(value)) return null

	for (const [key, nested] of Object.entries(value)) {
		if (isSensitiveKey(key)) return key
		const found = findSensitiveField(nested, seen)
		if (found) return found
	}
	return null
}

/** Rejects secret-bearing values at the general public user/profile boundary. */
export function assertPublicUserData(value: Record<string, unknown>): void {
	const field = findSensitiveField(value)
	if (!field) return
	const normalized = field.toLowerCase().replaceAll(/[^a-z0-9]/g, '')
	if (normalized === 'password' || normalized === 'passwordhash') {
		throw new Error('Password hashes must be updated through updatePasswordHash')
	}
	throw new Error('Secret-bearing fields require a dedicated auth capability')
}

/** Recursively removes secret-bearing fields before data crosses a public user boundary. */
export function omitSensitiveUserData(value: Record<string, unknown>): Record<string, unknown> {
	const projected = omitSensitive(value)
	return isPlainRecord(projected) ? projected : {}
}
