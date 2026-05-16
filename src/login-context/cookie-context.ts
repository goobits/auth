import type { Cookies } from "@sveltejs/kit";

type CookiesLike = Pick<Cookies, "set" | "get" | "delete">;

type LoginContextCookieOptions = {
	secure?: boolean;
	maxAge?: number;
	sameSite?: "lax" | "strict" | "none";
	path?: string;
};

export type CookieLoginContextConfig<Key extends string> = {
	cookies: Record<Key, string>;
	options?: LoginContextCookieOptions;
};

export type CookieLoginContextRuntimeOptions = LoginContextCookieOptions;

function buildCookieOptions(
	defaults: LoginContextCookieOptions | undefined,
	overrides: LoginContextCookieOptions | undefined,
) {
	return {
		httpOnly: true,
		secure: overrides?.secure ?? defaults?.secure ?? true,
		sameSite: overrides?.sameSite ?? defaults?.sameSite ?? "lax",
		path: overrides?.path ?? defaults?.path ?? "/",
		maxAge: overrides?.maxAge ?? defaults?.maxAge ?? 10 * 60,
	} as const;
}

export function createCookieLoginContext<const Key extends string>(
	config: CookieLoginContextConfig<Key>,
) {
	const entries = Object.entries(config.cookies) as Array<[Key, string]>;

	function get(cookies: Pick<CookiesLike, "get">): Record<Key, string | null> {
		return Object.fromEntries(
			entries.map(([key, cookieName]) => [key, cookies.get(cookieName) || null]),
		) as Record<Key, string | null>;
	}

	function set(
		cookies: Pick<CookiesLike, "set">,
		values: Partial<Record<Key, string | null | undefined>>,
		options?: CookieLoginContextRuntimeOptions,
	) {
		const cookieOptions = buildCookieOptions(config.options, options);
		for (const [key, cookieName] of entries) {
			const value = values[key];
			if (value) {
				cookies.set(cookieName, value, cookieOptions);
			}
		}
	}

	function clear(cookies: Pick<CookiesLike, "delete">, keys?: readonly Key[]) {
		const path = config.options?.path ?? "/";
		const selected = keys ? entries.filter(([key]) => keys.includes(key)) : entries;
		for (const [, cookieName] of selected) {
			cookies.delete(cookieName, { path });
		}
	}

	function take(cookies: Pick<CookiesLike, "get" | "delete">, keys?: readonly Key[]) {
		const value = get(cookies);
		clear(cookies, keys);
		return value;
	}

	return { get, set, clear, take };
}
