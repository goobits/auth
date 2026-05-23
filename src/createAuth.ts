import type { AuthConfig } from "./types/auth.js";
import { setLogger } from "./utils/logger.js";
import { validateConfig, resolveDefaults } from "./createAuth/config.js";
import { resolveSecurity, applyPolicies } from "./createAuth/security-setup.js";
import {
	createHandlers,
	buildRoutes,
	createUtils,
} from "./createAuth/handler-factory.js";

export function createAuth(config: AuthConfig) {
	setLogger(config.logger);
	validateConfig(config);
	const defaults = resolveDefaults(config);
	const security = resolveSecurity(config);
	const handlers = applyPolicies(
		createHandlers(config, defaults, security),
		security,
	);
	const routes = buildRoutes(handlers);
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
		utils: createUtils(defaults.isAuthenticated),
	};
}
