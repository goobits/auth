import type { OAuthIdentityAdapter } from '../adapters/oauth-identity/OAuthIdentityAdapter.ts'
import type { TokenAdapter } from '../adapters/oauth-token/TokenAdapter.ts'
import type { OAuthProvider } from '../providers/OAuthProvider.ts'
import type {
	AuthorizeOAuthIdentityChange,
	AuthRequestHandler,
	OAuthIdentityConfig
} from '../types/auth.ts'
import { jsonResponse } from '../utils/http.ts'

type OAuthIdentityHandlerConfig = {
	identityAdapter: OAuthIdentityAdapter
	providers: Record<string, OAuthProvider>
	authorizeIdentityChange: AuthorizeOAuthIdentityChange
	tokenAdapter?: TokenAdapter
	hooks?: OAuthIdentityConfig['hooks']
}

/** Lists connected providers without exposing stable provider subjects. */
export function createOAuthIdentityListHandler(
	config: Pick<OAuthIdentityHandlerConfig, 'identityAdapter'>
): AuthRequestHandler {
	return async (event) => {
		const user = event.locals.user
		const session = event.locals.session
		if (!user || !session || session.userId !== user.id) {
			return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
		}
		const identities = await config.identityAdapter.listIdentities(user.id)
		return jsonResponse({
			ok: true,
			providers: identities.map((identity) => identity.provider).sort()
		})
	}
}

/** Revokes and removes one provider identity after application-owned authorization. */
export function createOAuthIdentityUnlinkHandler(
	config: OAuthIdentityHandlerConfig
): AuthRequestHandler {
	return async (event) => {
		const user = event.locals.user
		const session = event.locals.session
		if (!user || !session || session.userId !== user.id) {
			return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
		}
		const authorizationRequest = event.request.clone()
		const form = await event.request.formData()
		const provider = form.get('provider')?.toString() ?? ''
		const providerInstance = config.providers[provider]
		if (!providerInstance) {
			return jsonResponse({ ok: false, error: 'Invalid OAuth provider' }, 400)
		}
		if (
			!(await config.authorizeIdentityChange({
				action: 'oauth.unlink',
				request: authorizationRequest,
				userId: user.id,
				session,
				provider
			}))
		) {
			return jsonResponse({ ok: false, error: 'Fresh authentication required' }, 403)
		}
		const identity = (await config.identityAdapter.listIdentities(user.id)).find(
			(candidate) => candidate.provider === provider
		)
		if (!identity) return jsonResponse({ ok: false, error: 'Provider is not connected' }, 404)

		if (config.tokenAdapter) {
			const tokens = await config.tokenAdapter.getTokens(user.id, provider)
			if (tokens) await providerInstance.revokeTokens(tokens)
			await config.tokenAdapter.deleteTokens(user.id, provider)
		}
		await config.identityAdapter.unlinkIdentity(user.id, provider)
		await config.hooks?.onUnlinked?.({ userId: user.id, provider, event })
		return jsonResponse({ ok: true })
	}
}
