import type { AuthConfig, AuthLocals } from "../types/auth.js";

export type ResolvedDefaults = {
	urlConfig: {
		login: string;
		afterLogin: string;
		afterLogout: string;
	};
	cookieConfig: {
		secure: boolean;
	};
	autoCreateSession: boolean;
	requireVerifiedEmailForLinking: boolean;
	isAuthenticated: (locals: AuthLocals) => boolean;
};

export function validateConfig(config: AuthConfig): void {
	if (!config.adapters.session) {
		throw new Error("createAuth requires adapters.session");
	}
	if (config.magicLink && !config.adapters.magicLink) {
		throw new Error("createAuth magicLink requires adapters.magicLink");
	}
	if (config.webauthn && !config.adapters.webauthn) {
		throw new Error("createAuth webauthn requires adapters.webauthn");
	}
}

export function resolveDefaults(config: AuthConfig): ResolvedDefaults {
	return {
		urlConfig: {
			login: config.urls?.login ?? "/auth",
			afterLogin: config.urls?.afterLogin ?? "/",
			afterLogout: config.urls?.afterLogout ?? "/",
		},
		cookieConfig: {
			secure: config.cookies?.secure ?? true,
		},
		autoCreateSession: config.autoCreateSession ?? true,
		requireVerifiedEmailForLinking: config.requireVerifiedEmailForLinking ?? true,
		isAuthenticated:
			config.isAuthenticated ?? ((locals: AuthLocals) => !!locals.user),
	};
}
