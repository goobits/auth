import {
	isRecord,
	parseFailure,
	parseMfaAction,
	readJsonRecord,
	requireSuccessFlag
} from './_response.ts'
import type {
	AuthClientContext,
	MfaActionResult,
	MfaEnrollmentResult,
	MfaStatusResult
} from './_types.ts'

export function createAccountSecurityClient(context: AuthClientContext) {
	const { authFetch, endpoints, withBase } = context
	return {
		async getMfaStatus(): Promise<MfaStatusResult> {
			const value = await readJsonRecord(
				await authFetch(withBase(endpoints.mfaStatus), { method: 'GET' })
			)
			if (!requireSuccessFlag(value)) return parseFailure(value)
			const status = value['status']
			if (
				!isRecord(status) ||
				typeof status['enabled'] !== 'boolean' ||
				(status['enabledAt'] !== null && typeof status['enabledAt'] !== 'string') ||
				typeof status['backupCodeCount'] !== 'number'
			) {
				throw new Error('Invalid authentication response')
			}
			return {
				success: true,
				status: {
					enabled: status['enabled'],
					enabledAt: status['enabledAt'],
					backupCodeCount: status['backupCodeCount']
				}
			}
		},

		async enrollMfa({
			currentPassword
		}: { currentPassword?: string } = {}): Promise<MfaEnrollmentResult> {
			const form = new FormData()
			if (currentPassword) form.set('currentPassword', currentPassword)
			const value = await readJsonRecord(
				await authFetch(withBase(endpoints.mfaEnroll), { method: 'POST', body: form })
			)
			if (!requireSuccessFlag(value)) return parseFailure(value)
			const backupCodes = value['backupCodes']
			if (
				typeof value['secret'] !== 'string' ||
				typeof value['otpauthUrl'] !== 'string' ||
				!Array.isArray(backupCodes) ||
				!backupCodes.every((code): code is string => typeof code === 'string')
			) {
				throw new Error('Invalid authentication response')
			}
			return {
				success: true,
				secret: value['secret'],
				otpauthUrl: value['otpauthUrl'],
				backupCodes
			}
		},

		async verifyMfa({ token }: { token: string }): Promise<MfaActionResult> {
			const form = new FormData()
			form.set('token', token)
			return parseMfaAction(
				await readJsonRecord(
					await authFetch(withBase(endpoints.mfaVerify), { method: 'POST', body: form })
				)
			)
		},

		async disableMfa({
			token,
			backupCode,
			currentPassword
		}: {
			token?: string
			backupCode?: string
			currentPassword?: string
		} = {}): Promise<MfaActionResult> {
			const form = new FormData()
			if (token) form.set('token', token)
			if (backupCode) form.set('backupCode', backupCode)
			if (currentPassword) form.set('currentPassword', currentPassword)
			return parseMfaAction(
				await readJsonRecord(
					await authFetch(withBase(endpoints.mfaDisable), { method: 'POST', body: form })
				)
			)
		},

		async stepUpMfa({
			token,
			backupCode
		}: { token?: string; backupCode?: string } = {}): Promise<MfaActionResult> {
			const form = new FormData()
			if (token) form.set('token', token)
			if (backupCode) form.set('backupCode', backupCode)
			return parseMfaAction(
				await readJsonRecord(
					await authFetch(withBase(endpoints.mfaStepUp), { method: 'POST', body: form })
				)
			)
		},

		async useMfaBackupCode({ code }: { code: string }): Promise<MfaActionResult> {
			const form = new FormData()
			form.set('code', code)
			return parseMfaAction(
				await readJsonRecord(
					await authFetch(withBase(endpoints.mfaBackupCode), { method: 'POST', body: form })
				)
			)
		}
	}
}
