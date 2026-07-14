import { resolveDefaults, validateConfig } from './createAuth/config.ts'
import { buildRoutes, createHandlers, createUtils } from './createAuth/handlerFactory.ts'
import { applyPolicies, resolveSecurity } from './createAuth/securitySetup.ts'
import type { AuthConfig } from './types/auth.ts'
import { setLogger } from './utils/logger.ts'

export function createAuth(config: AuthConfig) {
	setLogger(config.logger)
	validateConfig(config)
	const defaults = resolveDefaults(config)
	const security = resolveSecurity(config)
	const handlers = applyPolicies(createHandlers(config, defaults, security), security)
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
		routes,
		utils: createUtils(defaults.isAuthenticated)
	}
}
