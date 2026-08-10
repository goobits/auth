import type { AuthConfig, AuthLocals } from '../types/auth.ts'
import type { WebAuthnCredentialCreationAdapter } from '../adapters/webauthn/WebAuthnAdapter.ts'
import { isOAuthProviderName } from '../_routePaths.ts'

export type ResolvedDefaults = {
	urlConfig: {
		login: string
		afterLogin: string
		afterLogout: string
		oauthCancelled: string
	}
	cookieConfig: {
		secure: boolean
	}
	autoCreateSession: boolean
	isAuthenticated: (locals: AuthLocals) => boolean
}

export function validateConfig(config: AuthConfig): void {
	if (!config.adapters.session) {
		throw new Error('createAuth requires adapters.session')
	}
	if (config.magicLink && !config.adapters.magicLink) {
		throw new Error('createAuth magicLink requires adapters.magicLink')
	}
	if (config.webauthn) {
		const adapter = config.adapters.webauthn as
			| (NonNullable<typeof config.adapters.webauthn> & Partial<WebAuthnCredentialCreationAdapter>)
			| undefined
		if (!adapter) {
			throw new Error('createAuth webauthn requires adapters.webauthn')
		}
		if (typeof adapter.createCredentialWithinLimit !== 'function') {
			throw new Error(
				'createAuth webauthn requires an atomic createCredentialWithinLimit adapter capability'
			)
		}
	}
	if (config.mfa && !config.adapters.mfa) {
		throw new Error('createAuth mfa requires adapters.mfa')
	}
	if (config.mfa?.login && !config.adapters.verificationToken) {
		throw new Error('createAuth mfa.login requires adapters.verificationToken')
	}
	if (config.mfa?.login && config.hooks?.onLoginMode === 'manual') {
		throw new Error('createAuth mfa.login requires managed session creation')
	}
	if (config.oauth && (!config.providers || Object.keys(config.providers).length === 0)) {
		throw new Error('createAuth oauth requires at least one OAuth provider')
	}
	if (config.providers && Object.keys(config.providers).length > 0) {
		if (!config.adapters.user || !config.adapters.oauthIdentity) {
			throw new Error('createAuth OAuth providers require adapters.user and adapters.oauthIdentity')
		}
		for (const provider of Object.keys(config.providers)) {
			if (!isOAuthProviderName(provider)) {
				throw new Error(`createAuth OAuth provider name is invalid: ${provider}`)
			}
		}
	}
}

export function resolveDefaults(config: AuthConfig): ResolvedDefaults {
	return {
		urlConfig: {
			login: config.urls?.login ?? '/auth',
			afterLogin: config.urls?.afterLogin ?? '/',
			afterLogout: config.urls?.afterLogout ?? '/',
			oauthCancelled: config.urls?.oauthCancelled ?? config.urls?.login ?? '/auth'
		},
		cookieConfig: {
			secure: config.cookies?.secure ?? true
		},
		autoCreateSession: config.autoCreateSession ?? true,
		isAuthenticated: config.isAuthenticated ?? ((locals: AuthLocals) => !!locals.user)
	}
}
