import { createMagicLinkRequestHandler } from '../handlers/magicLinkRequest.ts'
import { createMagicLinkVerifyHandler } from '../handlers/magicLinkVerification.ts'
import type { MfaLoginConfig } from '../handlers/_mfaTypes.ts'
import {
	createMfaBackupCodeHandler,
	createMfaDisableHandler,
	createMfaEnrollHandler,
	createMfaStatusHandler,
	createMfaStepUpHandler,
	createMfaVerifyHandler
} from '../handlers/mfaManagement.ts'
import { createAuthRateLimiter } from '../security/rateLimit.ts'
import type {
	AuthConfig,
	AuthHandlers,
	AuthLocals,
	MagicLinkConfig,
	RequestEventLike
} from '../types/auth.ts'
import type { User } from '../types/index.ts'
import { jsonResponse } from '../utils/http.ts'
import type { ResolvedDefaults } from './config.ts'
import type { ResolvedSecurity } from './securitySetup.ts'

type AccountHandlers = Partial<Pick<AuthHandlers, 'magicLink' | 'mfa'>>

function normalizeMagicLinkConfig(
	magicLink: MagicLinkConfig,
	globalHooks: AuthConfig['hooks'],
	defaultSecureCookies: boolean
) {
	const settings = magicLink.settings ?? {}
	const limits = magicLink.limits ?? {}
	const hooks = magicLink.hooks ?? {}
	const normalized = {
		sendEmail: magicLink.send.email,
		secureCookies: settings.secureCookies ?? defaultSecureCookies,
		baseUrl: settings.baseUrl,
		...(settings.allowSignup !== undefined ? { allowSignup: settings.allowSignup } : {}),
		...(settings.expiresInMs !== undefined ? { expiresInMs: settings.expiresInMs } : {}),
		...(settings.magicLinkPath !== undefined ? { magicLinkPath: settings.magicLinkPath } : {}),
		...(settings.includeOtp !== undefined ? { includeOtp: settings.includeOtp } : {}),
		...(settings.otpDigits !== undefined ? { otpDigits: settings.otpDigits } : {}),
		...(settings.singleUsePerEmail !== undefined
			? { singleUsePerEmail: settings.singleUsePerEmail }
			: {}),
		...(settings.normalizeEmail !== undefined ? { normalizeEmail: settings.normalizeEmail } : {}),
		...(settings.otpPepper !== undefined ? { otpPepper: settings.otpPepper } : {}),
		...(settings.requireUserConfirmation !== undefined
			? { requireUserConfirmation: settings.requireUserConfirmation }
			: {}),
		...(settings.confirmationCookieName !== undefined
			? { confirmationCookieName: settings.confirmationCookieName }
			: {}),
		...(settings.confirmationTtlSeconds !== undefined
			? { confirmationTtlSeconds: settings.confirmationTtlSeconds }
			: {}),
		...(limits.request !== undefined ? { rateLimit: limits.request } : {}),
		...(limits.verify !== undefined ? { verifyRateLimit: limits.verify } : {}),
		...(hooks.getMetadata !== undefined ? { getMetadata: hooks.getMetadata } : {}),
		...(hooks.createUser !== undefined ? { createUser: hooks.createUser } : {}),
		...(hooks.sanitizeUser !== undefined ? { sanitizeUser: hooks.sanitizeUser } : {}),
		...(settings.key !== undefined ? { key: settings.key } : {})
	}
	const onAuthentication = globalHooks?.onAuthentication
	const beforeSessionCreate = globalHooks?.beforeSessionCreate
	return {
		...normalized,
		...(onAuthentication ? { onAuthentication } : {}),
		...(beforeSessionCreate ? { beforeSessionCreate } : {})
	}
}

function asJsonHandler(
	handler: (event: RequestEventLike) => Promise<unknown>
): NonNullable<AuthHandlers['mfa']>['status'] {
	return async (event) => jsonResponse(await handler(event as RequestEventLike))
}

export function createAccountHandlers(
	config: AuthConfig,
	defaults: ResolvedDefaults,
	security: ResolvedSecurity,
	mfaLogin: MfaLoginConfig | undefined
): AccountHandlers {
	const {
		adapters,
		hooks = {},
		magicLink,
		mfa,
		sanitizeUser = (user: User | null) => user
	} = config
	const { urlConfig, cookieConfig, autoCreateSession, isAuthenticated } = defaults
	const handlers: AccountHandlers = {}

	if (magicLink) {
		const normalized = normalizeMagicLinkConfig(magicLink, hooks, cookieConfig.secure)
		const sharedVerifyLimiter = createAuthRateLimiter('login', {
			keyPrefix: `${security.rateLimit.keyPrefix}:magic-verify`,
			...(security.rateLimit.store ? { store: security.rateLimit.store } : {}),
			...(security.rateLimit.logger ? { logger: security.rateLimit.logger } : {})
		})
		const requestConfig: Parameters<typeof createMagicLinkRequestHandler>[0] = {
			...normalized,
			magicLinkAdapter: adapters.magicLink!,
			...(security.audit.emitter ? { emitSecurityEvent: security.audit.emitter } : {}),
			...(config.logger ? { logger: config.logger } : {}),
			...(adapters.user ? { userAdapter: adapters.user } : {})
		}
		const verifyConfig: Parameters<typeof createMagicLinkVerifyHandler>[0] = {
			...normalized,
			magicLinkAdapter: adapters.magicLink!,
			sessionAdapter: adapters.session,
			autoCreateSession,
			onLoginMode: hooks.onLoginMode ?? 'augment',
			redirectAfterLogin: urlConfig.afterLogin,
			isAuthenticated,
			verifyRateLimit: normalized.verifyRateLimit ?? sharedVerifyLimiter.check,
			csrfCookieName: security.csrf.cookieName,
			...(security.audit.emitter ? { emitSecurityEvent: security.audit.emitter } : {}),
			...(config.logger ? { logger: config.logger } : {}),
			...(normalized['sanitizeUser'] === undefined ? { sanitizeUser } : {}),
			...(hooks.getSessionMetadata ? { getSessionMetadata: hooks.getSessionMetadata } : {}),
			...(mfaLogin ? { mfa: mfaLogin } : {}),
			...(adapters.user ? { userAdapter: adapters.user } : {})
		}
		handlers.magicLink = {
			request: createMagicLinkRequestHandler(requestConfig),
			verify: createMagicLinkVerifyHandler(verifyConfig)
		}
	}

	if (mfa) {
		const getUserId = (locals: AuthLocals) => locals.user?.id ?? null
		const mutations = config.credentialMutations?.mfa
		const mfaConfig = {
			authorizeSecurityChange: mfa.authorizeSecurityChange,
			getUserId,
			store: adapters.mfa!,
			...(mfa.issuer ? { issuer: mfa.issuer } : {}),
			...(mfa.label ? { label: mfa.label } : {}),
			...(mfa.hooks ? { hooks: mfa.hooks } : {})
		}
		handlers.mfa = {
			status: asJsonHandler(createMfaStatusHandler(mfaConfig)),
			enroll: asJsonHandler(createMfaEnrollHandler(mfaConfig)),
			verify: asJsonHandler(
				createMfaVerifyHandler({
					...mfaConfig,
					sessionAdapter: adapters.session,
					...(mutations ? { mutation: mutations.activate } : {})
				})
			),
			disable: asJsonHandler(
				createMfaDisableHandler({
					...mfaConfig,
					...(mutations ? { mutation: mutations.disable } : {})
				})
			),
			backupCode: asJsonHandler(createMfaBackupCodeHandler(mfaConfig)),
			stepUp: asJsonHandler(
				createMfaStepUpHandler({ ...mfaConfig, sessionAdapter: adapters.session })
			)
		}
	}

	return handlers
}
