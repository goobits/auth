import { resolveDefaults, validateConfig } from './createAuth/config.ts'
import {
	buildActions,
	buildRoutes,
	createHandlers,
	createUtils
} from './createAuth/handlerFactory.ts'
import { applyPolicies, resolveSecurity } from './createAuth/securitySetup.ts'
import type { AuthConfig } from './types/auth.ts'

export function createAuth(config: AuthConfig) {
	validateConfig(config)
	const defaults = resolveDefaults(config)
	const security = resolveSecurity(config)
	const handlers = applyPolicies(createHandlers(config, defaults, security), security)
	const actions = buildActions(handlers)
	const routes = buildRoutes(handlers)
	return {
		adapters: config.adapters,
		providers: config.providers ?? {},
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
