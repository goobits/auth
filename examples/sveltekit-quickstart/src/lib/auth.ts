import { GoobitsAuth } from '@goobits/auth'
import { drizzleAdapter } from '@goobits/auth/adapters/drizzle'
import { GoogleProvider } from '@goobits/auth/providers'
import { hasRecentMfaVerification, hasRecentPrimaryAuthentication } from '@goobits/auth/security'
import { MemoryRateLimitStore } from '@goobits/security/rate-limit'

import { env } from '$env/dynamic/private'
import { db, schema } from '$lib/server/db'
import { auditEmitter } from '$lib/server/security/audit'

// Replace this process-local store with shared durable state for multi-instance production.
const rateLimitStore = new MemoryRateLimitStore()
const adapter = drizzleAdapter(db, {
	schema,
	oauthTokenEncryption: {
		encryptionKeyringJson: env.TOKEN_ENCRYPTION_KEYRING
	}
})

export const auth = new GoobitsAuth({
	adapter,
	providers: {
		google: {
			provider: new GoogleProvider({
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
				callbackUrl: `${env.APP_URL}/auth/callback/google`
			})
		}
	},
	hooks: {
		onAuthentication: async ({ method, user }) => {
			if (user) return { userId: user.id }
			if (method.kind !== 'oauth' || method.intent !== 'sign-in') return
			if (await adapter.user.getUserByEmail(method.profile.email)) {
				return { redirectTo: '/login?error=account_exists' }
			}
			const created = await adapter.user.createUser(method.profile)
			return { userId: created.id }
		}
	},
	oauth: {
		authorizeIdentityChange: ({ session, userId }) =>
			session?.userId === userId &&
			(hasRecentPrimaryAuthentication(session, { maxAgeMs: 5 * 60_000 }) ||
				hasRecentMfaVerification(session, { maxAgeMs: 5 * 60_000 }))
	},
	security: {
		csrf: { secret: env.AUTH_CSRF_SECRET },
		rateLimit: { store: rateLimitStore },
		audit: { emitter: auditEmitter },
		alerts: {
			enabled: true,
			webhook: {
				url: env.SECURITY_WEBHOOK_URL
			}
		}
	}
})
