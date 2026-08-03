import type { AuthConfig, AuthLocals } from '../types/auth.ts'
import { isOAuthProviderName } from '../_routePaths.ts'

export type ResolvedDefaults = {
	urlConfig: {
		login: string
		afterLogin: string
		afterLogout: string
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
	if (config.webauthn && !config.adapters.webauthn) {
		throw new Error('createAuth webauthn requires adapters.webauthn')
	}
	if (config.mfa && !config.adapters.mfa) {
		throw new Error('createAuth mfa requires adapters.mfa')
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
			afterLogout: config.urls?.afterLogout ?? '/'
		},
		cookieConfig: {
			secure: config.cookies?.secure ?? true
		},
		autoCreateSession: config.autoCreateSession ?? true,
		isAuthenticated: config.isAuthenticated ?? ((locals: AuthLocals) => !!locals.user)
	}
}
