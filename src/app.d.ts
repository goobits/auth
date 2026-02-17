/// <reference types="@cloudflare/workers-types" />
/* eslint-disable @typescript-eslint/consistent-type-definitions */

import type { Session, User } from '@goobits/auth/types';

declare global {
	namespace App {
		interface Locals {
			user?: User | null;
			session?: Session | null;
			auth?: { user: User; session: Session } | null;
		}

		interface Platform {
			// Optional in local Node runtimes (e.g. `pnpm dev`); present on Cloudflare.
			env?: {
				DB?: D1Database;
				TURNSTILE_BYPASS?: string;
				TURNSTILE_SECRET_KEY?: string;
			};
			cf?: CfProperties;
			ctx?: ExecutionContext;
			caches?: CacheStorage;
		}
	}
}

export {};
