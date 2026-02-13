import { argon2id, argon2Verify } from 'argon2-wasm-edge'

type Argon2HashOptions = {
	salt?: Uint8Array | string
	memorySize?: number
	iterations?: number
	parallelism?: number
	hashLength?: number
}

const DEFAULT_PARAMS = {
	memorySize: 19456,
	iterations: 2,
	parallelism: 1,
	hashLength: 32
}

function toUint8Array(value: Uint8Array | string | undefined): Uint8Array | undefined {
	if (!value) return undefined
	if (value instanceof Uint8Array) return value
	return new TextEncoder().encode(value)
}

async function randomSalt(length = 16): Promise<Uint8Array> {
	const salt = new Uint8Array(length)
	if (globalThis.crypto?.getRandomValues) {
		globalThis.crypto.getRandomValues(salt)
		return salt
	}
	const { webcrypto } = await import('node:crypto')
	webcrypto.getRandomValues(salt)
	return salt
}

export async function hash(password: string, options: Argon2HashOptions = {}) {
	if (!password || typeof password !== 'string') {
		throw new Error('Password must be a non-empty string.')
	}

	const salt = toUint8Array(options.salt) ?? await randomSalt()
	const encoded = await argon2id({
		password,
		salt,
		memorySize: options.memorySize ?? DEFAULT_PARAMS.memorySize,
		iterations: options.iterations ?? DEFAULT_PARAMS.iterations,
		parallelism: options.parallelism ?? DEFAULT_PARAMS.parallelism,
		hashLength: options.hashLength ?? DEFAULT_PARAMS.hashLength,
		outputType: 'encoded'
	})

	if (typeof encoded === 'string') return encoded
	if (encoded && typeof encoded === 'object' && 'encoded' in (encoded as Record<string, unknown>)) {
		return String((encoded as { encoded: unknown }).encoded)
	}

	throw new Error('Failed to generate Argon2 hash.')
}

export async function verify(storedHash: string, password: string) {
	if (!storedHash || !password) return false
	return argon2Verify({ hash: storedHash, password })
}
