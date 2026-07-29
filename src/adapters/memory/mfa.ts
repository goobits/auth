import type { MfaStatus } from '../../types/index.ts'
import { MfaAdapter } from '../mfa/MfaAdapter.ts'

/** In-memory MFA adapter for TOTP secrets and backup codes. */
export class MemoryMfaAdapter extends MfaAdapter {
	#backupCodes = new Map<string, Set<string>>()
	#factors = new Map<string, { enabledAt: Date | null; secret: string }>()

	async beginEnrollment(userId: string, secret: string, backupCodes: string[]): Promise<boolean> {
		if (backupCodes.length === 0) return false
		const existing = this.#factors.get(userId)
		if (existing?.enabledAt) return false
		this.#factors.set(userId, {
			enabledAt: null,
			secret
		})
		this.#backupCodes.set(userId, new Set(backupCodes))
		return true
	}

	async getSecret(userId: string): Promise<string | null> {
		return this.#factors.get(userId)?.secret ?? null
	}

	async activateEnrollment(userId: string): Promise<boolean> {
		const existing = this.#factors.get(userId)
		if (!existing || existing.enabledAt || !this.#backupCodes.get(userId)?.size) return false
		this.#factors.set(userId, {
			...existing,
			enabledAt: new Date()
		})
		return true
	}

	async disableMfa(userId: string): Promise<boolean> {
		const removed = this.#factors.delete(userId)
		this.#backupCodes.delete(userId)
		return removed
	}

	async getBackupCodes(userId: string): Promise<string[]> {
		return [...(this.#backupCodes.get(userId) ?? [])]
	}

	async consumeBackupCode(userId: string, hash: string): Promise<boolean> {
		return this.#backupCodes.get(userId)?.delete(hash) ?? false
	}

	async getStatus(userId: string): Promise<MfaStatus> {
		const factor = this.#factors.get(userId)
		return {
			backupCodeCount: this.#backupCodes.get(userId)?.size ?? 0,
			enabled: Boolean(factor?.enabledAt),
			enabledAt: factor?.enabledAt ?? null
		}
	}
}
