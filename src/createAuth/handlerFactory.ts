import type { MfaLoginConfig } from '../handlers/_mfaTypes.ts'
import type { AuthConfig, AuthHandlers, AuthLocals } from '../types/auth.ts'
import { createAccountHandlers } from './_accountHandlers.ts'
import { createOAuthHandlers } from './_oauthHandlers.ts'
import { createSessionHandlers } from './_sessionHandlers.ts'
import { createWebAuthnHandlers } from './_webauthnHandlers.ts'
import type { ResolvedDefaults } from './config.ts'
import type { ResolvedSecurity } from './securitySetup.ts'

function resolveMfaLogin(
	config: AuthConfig,
	defaults: ResolvedDefaults
): MfaLoginConfig | undefined {
	const login = config.mfa?.login
	return login
		? {
				...login,
				store: config.adapters.mfa!,
				verificationTokenAdapter: config.adapters.verificationToken!,
				secureCookies: login.secureCookies ?? defaults.cookieConfig.secure,
				challengeRedirect: login.challengeRedirect ?? defaults.urlConfig.login
			}
		: undefined
}

export function createHandlers(
	config: AuthConfig,
	defaults: ResolvedDefaults,
	security: ResolvedSecurity
): AuthHandlers {
	const mfaLogin = resolveMfaLogin(config, defaults)
	const webauthn = createWebAuthnHandlers(config, defaults, security)
	return {
		...createSessionHandlers(config, defaults, security),
		...createOAuthHandlers(config, defaults, mfaLogin),
		...createAccountHandlers(config, defaults, security, mfaLogin),
		...(webauthn ? { webauthn } : {})
	}
}

export function createUtils(isAuthenticated: (locals: AuthLocals) => boolean) {
	return {
		isAuthenticated: (locals: AuthLocals) => isAuthenticated(locals),
		getUser: (locals: AuthLocals) => locals.user,
		getSession: (locals: AuthLocals) => locals.session
	}
}
