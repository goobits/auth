import { verifyBackupCode } from '../mfa/backupCodes.ts'
import { verifyTOTP } from '../mfa/totp.ts'

type MfaCredentialStore = {
	consumeBackupCode: (userId: string, hash: string) => Promise<boolean>
	getBackupCodes: (userId: string) => Promise<string[]>
	getSecret: (userId: string) => Promise<string | null>
	getStatus: (userId: string) => Promise<{ enabled: boolean }>
}

export type MfaCredentialProof = { method: 'totp' } | { method: 'backup-code'; hash: string }

export async function verifyMfaCredential({
	store,
	userId,
	token,
	backupCode
}: {
	store: MfaCredentialStore
	userId: string
	token: string
	backupCode: string
}): Promise<MfaCredentialProof | null> {
	if (!(await store.getStatus(userId)).enabled) return null
	if (token) {
		const secret = await store.getSecret(userId)
		return secret && (await verifyTOTP({ secret, token })) ? { method: 'totp' } : null
	}
	if (!backupCode) return null
	const result = await verifyBackupCode({
		code: backupCode,
		hashedCodes: await store.getBackupCodes(userId)
	})
	return result.valid && result.hash ? { method: 'backup-code', hash: result.hash } : null
}

export async function consumeMfaCredentialProof(
	store: MfaCredentialStore,
	userId: string,
	proof: MfaCredentialProof
): Promise<boolean> {
	return proof.method === 'totp' || (await store.consumeBackupCode(userId, proof.hash))
}
