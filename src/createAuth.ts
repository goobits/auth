import { resolveDefaults, validateConfig } from './createAuth/config.ts'
import {
	buildActions,
	buildRoutes,
	createHandlers,
	createUtils
} from './createAuth/handlerFactory.ts'
import { applyPolicies, resolveSecurity } from './createAuth/securitySetup.ts'
import type { OAuthProviderMetadata } from './providers/OAuthProvider.ts'
import type { AuthConfig, OAuthProviderConfig } from './types/auth.ts'

function providerMetadata(
	providers: Record<string, OAuthProviderConfig>
): Readonly<Record<string, OAuthProviderMetadata>> {
	return Object.freeze(
		Object.fromEntries(
			Object.entries(providers).map(([key, config]) => [
				key,
				Object.freeze({
					name: config.provider.name,
					callbackMode: config.provider.callbackMode
				})
			])
		)
	)
}

export function createAuth(config: AuthConfig) {
	validateConfig(config)
	const defaults = resolveDefaults(config)
	const security = resolveSecurity(config)
	const handlers = applyPolicies(createHandlers(config, defaults, security), security)
	const actions = buildActions(handlers)
	const routes = buildRoutes(handlers)
	return {
		adapters: config.adapters,
		providers: providerMetadata(config.providers ?? {}),
		urls: defaults.urlConfig,
		cookies: defaults.cookieConfig,
		profile: security.profile,
		security,
		hooks: config.hooks ?? {},
		handlers,
		actions,
		routes,
		utils: createUtils(defaults.isAuthenticated)
	}
}
