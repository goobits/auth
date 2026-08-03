import type { OAuthIdentityAdapter } from '../adapters/oauth-identity/OAuthIdentityAdapter.ts'
import type { TokenAdapter } from '../adapters/oauth-token/TokenAdapter.ts'
import type { OAuthProvider } from '../providers/OAuthProvider.ts'
import { createDefaultOAuthCredentialMutations } from '../createAuth/credentialMutations.ts'
import type {
	AuthorizeOAuthIdentityChange,
	AuthRequestHandler,
	CredentialMutationPort,
	OAuthIdentityConfig
} from '../types/auth.ts'
import { jsonResponse } from '../utils/http.ts'

type OAuthIdentityHandlerConfig = {
	identityAdapter: OAuthIdentityAdapter
	providers: Record<string, OAuthProvider>
	authorizeIdentityChange: AuthorizeOAuthIdentityChange
	tokenAdapter?: TokenAdapter
	hooks?: OAuthIdentityConfig['hooks']
	mutation?: NonNullable<CredentialMutationPort['oauth']>['unlink']
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
	const mutation =
		config.mutation ??
		createDefaultOAuthCredentialMutations({
			identityAdapter: config.identityAdapter,
			...(config.tokenAdapter ? { tokenAdapter: config.tokenAdapter } : {}),
			...(config.hooks ? { hooks: config.hooks } : {})
		}).unlink
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
		const outcome = await mutation({
			userId: user.id,
			provider,
			session,
			authorizationRequest,
			event,
			authorize: () =>
				config.authorizeIdentityChange({
					action: 'oauth.unlink',
					request: authorizationRequest,
					userId: user.id,
					session,
					provider
				}),
			revokeTokens: (tokens) => providerInstance.revokeTokens(tokens)
		})
		if (outcome === 'forbidden') {
			return jsonResponse({ ok: false, error: 'Fresh authentication required' }, 403)
		}
		if (outcome === 'not-found') {
			return jsonResponse({ ok: false, error: 'Provider is not connected' }, 404)
		}
		return jsonResponse({ ok: true })
	}
}
