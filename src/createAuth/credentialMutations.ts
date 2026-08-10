import type { OAuthIdentityAdapter } from '../adapters/oauth-identity/OAuthIdentityAdapter.ts'
import type { TokenAdapter } from '../adapters/oauth-token/TokenAdapter.ts'
import type { WebAuthnAdapter } from '../adapters/webauthn/WebAuthnAdapter.ts'
import type { MfaAdapter } from '../adapters/mfa/MfaAdapter.ts'
import { AuthPrincipalResolutionError } from '../errors/AuthPrincipalResolutionError.ts'
import { consumeMfaCredentialProof } from '../handlers/_mfaCredential.ts'
import type {
	CredentialMutationPort,
	TotpMfaConfig,
	OAuthIdentityConfig,
	WebAuthnCredentialLifecycleInput
} from '../types/auth.ts'

type OAuthMutationDefaults = {
	identityAdapter: OAuthIdentityAdapter
	tokenAdapter?: TokenAdapter
	hooks?: OAuthIdentityConfig['hooks']
}

/** Composes an ordinary MFA adapter and lifecycle hooks into the application mutation port. */
export function createDefaultMfaCredentialMutations(defaults: {
	mfaAdapter: Pick<
		MfaAdapter,
		'activateEnrollment' | 'consumeBackupCode' | 'consumeTotpCounter' | 'disableMfa'
	>
	hooks?: TotpMfaConfig['hooks']
}): NonNullable<CredentialMutationPort['mfa']> {
	return {
		activate: async (input) => {
			const proof = await input.verify()
			if (!proof) return 'invalid-proof'
			if (!(await defaults.mfaAdapter.activateEnrollment(input.userId, proof.counter))) {
				return 'not-found'
			}
			await defaults.hooks?.onEnabled?.({ userId: input.userId, event: input.event })
			return 'success'
		},
		disable: async (input) => {
			if (!(await input.authorize())) return 'forbidden'
			const proof = await input.verify()
			if (!proof || !(await consumeMfaCredentialProof(defaults.mfaAdapter, input.userId, proof))) {
				return 'invalid-proof'
			}
			if (!(await defaults.mfaAdapter.disableMfa(input.userId))) return 'not-found'
			await defaults.hooks?.onDisabled?.({ userId: input.userId, event: input.event })
			return 'success'
		}
	}
}

/** Composes ordinary OAuth adapters into the same port used by atomic applications. */
export function createDefaultOAuthCredentialMutations(
	defaults: OAuthMutationDefaults
): NonNullable<CredentialMutationPort['oauth']> {
	return {
		connect: async (input) => {
			const identity = await defaults.identityAdapter.getIdentity(input.provider, input.subject)
			if (identity && identity.userId !== input.userId) {
				throw new AuthPrincipalResolutionError(
					'Provider is already connected to another account',
					409
				)
			}
			if (input.intent === 'reauth' && !identity) {
				throw new AuthPrincipalResolutionError('Provider is not connected', 403)
			}

			const linked = !identity
			if (linked) {
				await defaults.identityAdapter.linkIdentity({
					userId: input.userId,
					provider: input.provider,
					subject: input.subject
				})
			}
			await defaults.tokenAdapter?.storeTokens(input.userId, input.provider, input.tokens)
			if (linked) {
				await defaults.hooks?.onLinked?.({
					userId: input.userId,
					provider: input.provider,
					subject: input.subject,
					event: input.event
				})
			}
			await input.completeAuthentication()
			return { linked }
		},
		unlink: async (input) => {
			if (!(await input.authorize())) return 'forbidden'
			const identity = (await defaults.identityAdapter.listIdentities(input.userId)).find(
				(candidate) => candidate.provider === input.provider
			)
			if (!identity) return 'not-found'

			if (defaults.tokenAdapter) {
				const tokens = await defaults.tokenAdapter.getTokens(input.userId, input.provider)
				if (tokens) await input.revokeTokens(tokens)
				await defaults.tokenAdapter.deleteTokens(input.userId, input.provider)
			}
			await defaults.identityAdapter.unlinkIdentity(input.userId, input.provider)
			await defaults.hooks?.onUnlinked?.({
				userId: input.userId,
				provider: input.provider,
				event: input.event
			})
			return 'success'
		}
	}
}

/** Composes the ordinary WebAuthn adapter and lifecycle hook into one mutation. */
export function createDefaultWebAuthnCredentialMutation(defaults: {
	webauthnAdapter: Pick<WebAuthnAdapter, 'deleteCredential'>
	onCredentialDeleted?: (input: WebAuthnCredentialLifecycleInput) => Promise<void> | void
}): NonNullable<NonNullable<CredentialMutationPort['webauthn']>['remove']> {
	return async (input) => {
		if (!(await input.authorize())) return 'forbidden'
		if (
			!(await defaults.webauthnAdapter.deleteCredential({
				userId: input.userId,
				credentialId: input.credentialId
			}))
		) {
			return 'not-found'
		}
		await defaults.onCredentialDeleted?.({
			userId: input.userId,
			credentialId: input.credentialId,
			event: input.event
		})
		return 'success'
	}
}
