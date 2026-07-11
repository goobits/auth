import type { MfaStatus } from '../../types/index.ts'

/**
 * Stores TOTP secrets and backup-code hashes for MFA enrollment.
 */
export abstract class MfaAdapter {
	/**
	 * Store or replace a user's pending TOTP secret.
	 * @param userId User identifier.
	 * @param secret Base32 TOTP secret.
	 */
	abstract setSecret(userId: string, secret: string): Promise<void>

	/**
	 * Return a user's TOTP secret, when enrollment has started.
	 * @param userId User identifier.
	 * @returns Stored TOTP secret or null.
	 */
	abstract getSecret(userId: string): Promise<string | null>

	/**
	 * Mark MFA enabled for a user.
	 * @param userId User identifier.
	 */
	abstract enableMfa(userId: string): Promise<void>

	/**
	 * Disable MFA and remove related TOTP material.
	 * @param userId User identifier.
	 */
	abstract disableMfa(userId: string): Promise<void>

	/**
	 * Replace a user's backup-code hashes.
	 * @param userId User identifier.
	 * @param codes Backup-code hashes.
	 */
	abstract setBackupCodes(userId: string, codes: string[]): Promise<void>

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
	 */
	abstract consumeBackupCode(userId: string, hash: string): Promise<void>

	/**
	 * Return MFA enrollment status.
	 * @param userId User identifier.
	 * @returns MFA status for the user.
	 */
	abstract getStatus(userId: string): Promise<MfaStatus>
}
