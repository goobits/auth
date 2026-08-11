import type { MfaSecretCodec } from '../../src/adapters/pg/index.ts'

export const mfaSecretCodec: MfaSecretCodec = {
	async encrypt(secret, userId) {
		return `test-seal:${userId}:${[...secret].reverse().join('')}`
	},
	async decrypt(ciphertext, userId) {
		const prefix = `test-seal:${userId}:`
		if (!ciphertext.startsWith(prefix)) throw new Error('Invalid test MFA ciphertext')
		return [...ciphertext.slice(prefix.length)].reverse().join('')
	}
}
