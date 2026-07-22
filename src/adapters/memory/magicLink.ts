import { MagicLinkAdapter } from '../magic-link/MagicLinkAdapter.ts'

type StoredMagicLinkToken = {
	id: string
	userId: string | null
	email: string
	tokenHash: string
	otpHash?: string | null
	expiresAt: Date
	metadata?: Record<string, unknown>
}

/** In-memory magic link adapter for local development and tests. */
export class MemoryMagicLinkAdapter extends MagicLinkAdapter {
	#counter = 0
	#tokens = new Map<string, StoredMagicLinkToken>()

	async createToken({
		userId,
		email,
		tokenHash,
		otpHash,
		expiresAt,
		metadata
	}: {
		userId: string | null
		email: string
		tokenHash: string
		otpHash?: string | null
		expiresAt: Date
		metadata?: Record<string, unknown>
	}): Promise<Record<string, unknown>> {
		const id = `magic-${++this.#counter}`
		const token: StoredMagicLinkToken = {
			id,
			userId,
			email,
			tokenHash,
			otpHash: otpHash ?? null,
			expiresAt,
			...(metadata ? { metadata } : {})
		}
		this.#tokens.set(id, token)
		return token
	}

	async findByTokenHash(tokenHash: string): Promise<Record<string, unknown> | null> {
		for (const token of this.#tokens.values()) {
			if (token.tokenHash === tokenHash) return token
		}
		return null
	}

	async findByEmailAndOtpHash({
		email,
		otpHash
	}: {
		email: string
		otpHash: string
	}): Promise<Record<string, unknown> | null> {
		for (const token of this.#tokens.values()) {
			if (token.email === email && token.otpHash === otpHash) return token
		}
		return null
	}

	async deleteById(tokenId: string): Promise<void> {
		this.#tokens.delete(tokenId)
	}

	async deleteByUserId(userId: string): Promise<void> {
		for (const [id, token] of this.#tokens.entries()) {
			if (token.userId === userId) this.#tokens.delete(id)
		}
	}

	async deleteByEmail(email: string): Promise<void> {
		for (const [id, token] of this.#tokens.entries()) {
			if (token.email === email) this.#tokens.delete(id)
		}
	}

	async consumeByTokenHash(tokenHash: string): Promise<Record<string, unknown> | null> {
		const token = await this.findByTokenHash(tokenHash)
		const id = typeof token?.['id'] === 'string' ? token['id'] : null
		if (id) this.#tokens.delete(id)
		return token
	}

	async consumeByEmailAndOtpHash(params: {
		email: string
		otpHash: string
	}): Promise<Record<string, unknown> | null> {
		const token = await this.findByEmailAndOtpHash(params)
		const id = typeof token?.['id'] === 'string' ? token['id'] : null
		if (id) this.#tokens.delete(id)
		return token
	}
}
