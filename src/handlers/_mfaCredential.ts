import { verifyBackupCode } from '../mfa/backupCodes.ts'
import { matchTOTP } from '../mfa/totp.ts'
import type { MfaCredentialProof } from '../types/auth.ts'

type MfaCredentialConsumptionStore = {
	consumeBackupCode: (userId: string, hash: string) => Promise<boolean>
	consumeTotpCounter: (userId: string, counter: number) => Promise<boolean>
}

type MfaCredentialStore = MfaCredentialConsumptionStore & {
	getBackupCodes: (userId: string) => Promise<string[]>
	getSecret: (userId: string) => Promise<string | null>
	getStatus: (userId: string) => Promise<{ enabled: boolean }>
}

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
		if (!secret) return null
		const match = await matchTOTP({ secret, token })
		return match ? { method: 'totp', counter: match.counter } : null
	}
	if (!backupCode) return null
	const result = await verifyBackupCode({
		code: backupCode,
		hashedCodes: await store.getBackupCodes(userId)
	})
	return result.valid && result.hash ? { method: 'backup-code', hash: result.hash } : null
}

export async function consumeMfaCredentialProof(
	store: MfaCredentialConsumptionStore,
	userId: string,
	proof: MfaCredentialProof
): Promise<boolean> {
	return proof.method === 'totp'
		? store.consumeTotpCounter(userId, proof.counter)
		: store.consumeBackupCode(userId, proof.hash)
}
