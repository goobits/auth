/// <reference types="@cloudflare/workers-types" />

declare global {
	namespace App {
		type Platform = {
			env: {
				DB: D1Database;
			};
			cf: CfProperties;
			ctx: ExecutionContext;
			caches: CacheStorage;
		};
	}
}

export {};
