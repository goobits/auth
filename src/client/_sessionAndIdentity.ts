import { isOAuthProviderName } from '../_routePaths.ts'
import {
	parseSessionFailure,
	parseSessionSummary,
	readJsonRecord
} from './_response.ts'
import type {
	AuthClientContext,
	SessionActionResult,
	SessionListResult
} from './_types.ts'

export function createSessionAndIdentityClient(context: AuthClientContext) {
	const { authFetch, endpoints, jsonHeaders, withBase } = context
	return {
		async listSessions(): Promise<SessionListResult> {
			const value = await readJsonRecord(
				await authFetch(withBase(endpoints.sessions), { method: 'GET' })
			)
			if (typeof value['ok'] !== 'boolean') throw new Error('Invalid authentication response')
			if (!value['ok']) return parseSessionFailure(value)
			if (!Array.isArray(value['sessions'])) throw new Error('Invalid authentication response')
			return { ok: true, sessions: value['sessions'].map(parseSessionSummary) }
		},

		async revokeSession({
			sessionId,
			all,
			others
		}: { sessionId?: string; all?: boolean; others?: boolean } = {}): Promise<SessionActionResult> {
			const value = await readJsonRecord(
				await authFetch(withBase(endpoints.sessionRevoke), {
					method: 'POST',
					headers: jsonHeaders,
					body: JSON.stringify({ sessionId, all, others })
				})
			)
			if (typeof value['ok'] !== 'boolean') throw new Error('Invalid authentication response')
			return value['ok'] ? { ok: true } : parseSessionFailure(value)
		},

		async listOAuthIdentities(): Promise<
			{ ok: true; providers: string[] } | { ok: false; error: string }
		> {
			const value = await readJsonRecord(
				await authFetch(withBase(endpoints.oauthIdentities), { method: 'GET' })
			)
			if (value['ok'] === false) return parseSessionFailure(value)
			if (
				value['ok'] !== true ||
				!Array.isArray(value['providers']) ||
				!value['providers'].every((provider) => typeof provider === 'string')
			) {
				throw new Error('Invalid authentication response')
			}
			return { ok: true, providers: value['providers'] }
		},

		async unlinkOAuthIdentity(provider: string): Promise<SessionActionResult> {
			if (!isOAuthProviderName(provider)) throw new Error('Invalid OAuth provider')
			const form = new FormData()
			form.set('provider', provider)
			const value = await readJsonRecord(
				await authFetch(withBase(endpoints.oauthUnlink), { method: 'POST', body: form })
			)
			if (typeof value['ok'] !== 'boolean') throw new Error('Invalid authentication response')
			return value['ok'] ? { ok: true } : parseSessionFailure(value)
		}
	}
}
