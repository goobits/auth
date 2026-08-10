import { applySecurityPolicy, type SecurityPolicySettings } from '../security/policy.ts'
import type { AuthHandlers } from '../types/auth.ts'

export function applyPolicies(handlers: AuthHandlers, security: SecurityPolicySettings): AuthHandlers {
	const wrapped: AuthHandlers = {
		...handlers,
		logout: applySecurityPolicy({
			handler: handlers.logout,
			routeId: 'auth.logout',
			settings: security
		})
	}
	if (handlers.login) {
		wrapped.login = applySecurityPolicy({
			handler: handlers.login,
			routeId: 'oauth.login',
			settings: security
		})
	}
	if (handlers.callback) {
		wrapped.callback = applySecurityPolicy({
			handler: handlers.callback,
			routeId: 'oauth.callback',
			settings: security
		})
	}
	if (handlers.magicLink) {
		wrapped.magicLink = {
			request: applySecurityPolicy({
				handler: handlers.magicLink.request,
				routeId: 'magic.request',
				settings: security
			}),
			verify: applySecurityPolicy({
				handler: handlers.magicLink.verify,
				routeId: 'magic.verify',
				settings: security
			})
		}
	}
	if (handlers.webauthn) {
		wrapped.webauthn = {
			registerOptions: applySecurityPolicy({
				handler: handlers.webauthn.registerOptions,
				routeId: 'webauthn.register.options',
				settings: security
			}),
			registerVerify: applySecurityPolicy({
				handler: handlers.webauthn.registerVerify,
				routeId: 'webauthn.register.verify',
				settings: security
			}),
			loginOptions: applySecurityPolicy({
				handler: handlers.webauthn.loginOptions,
				routeId: 'webauthn.login.options',
				settings: security
			}),
			loginVerify: applySecurityPolicy({
				handler: handlers.webauthn.loginVerify,
				routeId: 'webauthn.login.verify',
				settings: security
			}),
			listCredentials: applySecurityPolicy({
				handler: handlers.webauthn.listCredentials,
				routeId: 'webauthn.credentials.list',
				settings: security
			}),
			removeCredential: applySecurityPolicy({
				handler: handlers.webauthn.removeCredential,
				routeId: 'webauthn.credentials.remove',
				settings: security
			}),
			stepUpOptions: applySecurityPolicy({
				handler: handlers.webauthn.stepUpOptions,
				routeId: 'webauthn.step_up.options',
				settings: security
			}),
			stepUpVerify: applySecurityPolicy({
				handler: handlers.webauthn.stepUpVerify,
				routeId: 'webauthn.step_up.verify',
				settings: security
			})
		}
	}
	if (handlers.mfa) {
		wrapped.mfa = {
			status: applySecurityPolicy({
				handler: handlers.mfa.status,
				routeId: 'mfa.status',
				settings: security
			}),
			enroll: applySecurityPolicy({
				handler: handlers.mfa.enroll,
				routeId: 'mfa.enroll',
				settings: security
			}),
			verify: applySecurityPolicy({
				handler: handlers.mfa.verify,
				routeId: 'mfa.verify',
				settings: security
			}),
			disable: applySecurityPolicy({
				handler: handlers.mfa.disable,
				routeId: 'mfa.disable',
				settings: security
			}),
			backupCode: applySecurityPolicy({
				handler: handlers.mfa.backupCode,
				routeId: 'mfa.backup_code',
				settings: security
			}),
			stepUp: applySecurityPolicy({
				handler: handlers.mfa.stepUp,
				routeId: 'mfa.step_up',
				settings: security
			})
		}
	}
	if (handlers.sessions) {
		wrapped.sessions = {
			list: applySecurityPolicy({
				handler: handlers.sessions.list,
				routeId: 'sessions.list',
				settings: security
			}),
			revoke: applySecurityPolicy({
				handler: handlers.sessions.revoke,
				routeId: 'sessions.revoke',
				settings: security
			})
		}
	}
	if (handlers.oauth) {
		wrapped.oauth = {
			identities: applySecurityPolicy({
				handler: handlers.oauth.identities,
				routeId: 'oauth.identities.list',
				settings: security
			}),
			unlink: applySecurityPolicy({
				handler: handlers.oauth.unlink,
				routeId: 'oauth.identity.unlink',
				settings: security
			})
		}
	}
	return wrapped
}
