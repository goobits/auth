import type { MfaStatus } from '../../types/core.ts'

/** Application key-management boundary used by persistent MFA adapters. */
export type MfaSecretCodec = {
	encrypt(secret: string, userId: string): Promise<string>
	decrypt(ciphertext: string, userId: string): Promise<string>
}

/**
 * Stores TOTP secrets and backup-code hashes for MFA enrollment.
 */
export abstract class MfaAdapter {
	protected assertTotpCounter(counter: number): void {
		if (!Number.isSafeInteger(counter) || counter < 0) {
			throw new RangeError('TOTP counter must be a non-negative safe integer')
		}
	}

	/**
	 * Atomically begin or replace a pending MFA enrollment.
	 * Active factors must not be replaced.
	 * @param userId User identifier.
	 * @param secret Base32 TOTP secret.
	 * @param backupCodes Backup-code hashes created for the pending factor.
	 * @returns Whether enrollment was stored.
	 */
	abstract beginEnrollment(userId: string, secret: string, backupCodes: string[]): Promise<boolean>

	/**
	 * Return a user's TOTP secret, when enrollment has started.
	 * @param userId User identifier.
	 * @returns Stored TOTP secret or null.
	 */
	abstract getSecret(userId: string): Promise<string | null>

	/**
	 * Activate a pending MFA enrollment.
	 * @param userId User identifier.
	 * @returns Whether a complete pending enrollment was activated.
	 */
	abstract activateEnrollment(userId: string, counter: number): Promise<boolean>

	/**
	 * Disable MFA and remove related TOTP material.
	 * @param userId User identifier.
	 * @returns Whether an MFA factor was removed.
	 */
	abstract disableMfa(userId: string): Promise<boolean>

	/**
	 * Return unused backup-code hashes for a user.
	 * @param userId User identifier.
	 * @returns Backup-code hashes.
	 */
	abstract getBackupCodes(userId: string): Promise<string[]>

	/**
	 * Consume one backup-code hash.
	 * @param userId User identifier.
	 * @param hash Backup-code hash.
	 * @returns Whether the unused code was consumed.
	 */
	abstract consumeBackupCode(userId: string, hash: string): Promise<boolean>

	/**
	 * Atomically accept a TOTP counter only when it is newer than the last accepted counter.
	 * @param userId User identifier.
	 * @param counter RFC 6238 moving-factor counter matched by the token.
	 * @returns Whether the counter was accepted for an enabled factor.
	 */
	abstract consumeTotpCounter(userId: string, counter: number): Promise<boolean>

	/**
	 * Return MFA enrollment status.
	 * @param userId User identifier.
	 * @returns MFA status for the user.
	 */
	abstract getStatus(userId: string): Promise<MfaStatus>
}
