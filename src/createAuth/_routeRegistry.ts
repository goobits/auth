import type { AuthHandlers, AuthRoutes } from '../types/auth.ts'

function requireHandlers<T>(handlers: T | undefined, feature: string): T {
	if (!handlers) throw new Error(`${feature} handlers not configured`)
	return handlers
}

export function buildRoutes(handlers: AuthHandlers): AuthRoutes {
	return {
		login: () => ({
			GET: requireHandlers(handlers.login, 'OAuth login')
		}),
		callback: () => {
			const callback = requireHandlers(handlers.callback, 'OAuth callback')
			return { GET: callback, POST: callback }
		},
		logout: () => ({ POST: handlers.logout }),
		magicLink: () => ({
			POST: requireHandlers(handlers.magicLink, 'Magic link').request
		}),
		magicLinkVerify: () => {
			const magicLink = requireHandlers(handlers.magicLink, 'Magic link')
			return { GET: magicLink.verify, POST: magicLink.verify }
		},
		passkeyRegisterOptions: () => ({
			POST: requireHandlers(handlers.webauthn, 'WebAuthn').registerOptions
		}),
		passkeyRegisterVerify: () => ({
			POST: requireHandlers(handlers.webauthn, 'WebAuthn').registerVerify
		}),
		passkeyLoginOptions: () => ({
			POST: requireHandlers(handlers.webauthn, 'WebAuthn').loginOptions
		}),
		passkeyLoginVerify: () => ({
			POST: requireHandlers(handlers.webauthn, 'WebAuthn').loginVerify
		}),
		passkeyCredentials: () => {
			const webauthn = requireHandlers(handlers.webauthn, 'WebAuthn')
			return { GET: webauthn.listCredentials, POST: webauthn.removeCredential }
		},
		passkeyStepUpOptions: () => ({
			POST: requireHandlers(handlers.webauthn, 'WebAuthn').stepUpOptions
		}),
		passkeyStepUpVerify: () => ({
			POST: requireHandlers(handlers.webauthn, 'WebAuthn').stepUpVerify
		}),
		mfaStatus: () => ({ GET: requireHandlers(handlers.mfa, 'MFA').status }),
		mfaEnroll: () => ({ POST: requireHandlers(handlers.mfa, 'MFA').enroll }),
		mfaVerify: () => ({ POST: requireHandlers(handlers.mfa, 'MFA').verify }),
		mfaDisable: () => ({ POST: requireHandlers(handlers.mfa, 'MFA').disable }),
		mfaBackupCode: () => ({ POST: requireHandlers(handlers.mfa, 'MFA').backupCode }),
		mfaStepUp: () => ({ POST: requireHandlers(handlers.mfa, 'MFA').stepUp }),
		sessions: () => {
			const sessions = requireHandlers(handlers.sessions, 'Session')
			return { GET: sessions.list, POST: sessions.revoke }
		},
		oauthIdentities: () => ({
			GET: requireHandlers(handlers.oauth, 'OAuth identity').identities
		}),
		oauthUnlink: () => ({
			POST: requireHandlers(handlers.oauth, 'OAuth identity').unlink
		})
	}
}
