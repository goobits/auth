/// <reference types="@cloudflare/workers-types" />
/* eslint-disable @typescript-eslint/consistent-type-definitions */

declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				TURNSTILE_BYPASS?: string;
				TURNSTILE_SECRET_KEY?: string;
			};
			cf: CfProperties;
			ctx: ExecutionContext;
			caches: CacheStorage;
		}
	}
}

export {};
