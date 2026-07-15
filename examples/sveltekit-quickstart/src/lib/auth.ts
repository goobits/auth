import { GoobitsAuth } from '@goobits/auth'
import { drizzleAdapter } from '@goobits/auth/adapters/drizzle'
import { GoogleProvider } from '@goobits/auth/providers'
import { MemoryRateLimitStore } from '@goobits/security/rate-limit'

import { env } from '$env/dynamic/private'
import { db, schema } from '$lib/server/db'

// Replace this process-local store with shared durable state for multi-instance production.
const rateLimitStore = new MemoryRateLimitStore()

export const auth = new GoobitsAuth({
	adapter: drizzleAdapter(db, {
		schema,
		oauthTokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY
	}),
	providers: {
		google: {
			provider: new GoogleProvider({
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
				callbackUrl: `${env.APP_URL}/auth/callback/google`
			})
		}
	},
	security: {
		rateLimit: { store: rateLimitStore },
		alerts: {
			enabled: true,
			webhook: {
				url: env.SECURITY_WEBHOOK_URL
			}
		}
	}
})
