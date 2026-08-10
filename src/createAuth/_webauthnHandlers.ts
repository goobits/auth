import {
	createWebAuthnLoginOptionsHandler,
	createWebAuthnLoginVerifyHandler,
	createWebAuthnListCredentialsHandler,
	createWebAuthnRemoveCredentialHandler,
	createWebAuthnRegisterOptionsHandler,
	createWebAuthnRegisterVerifyHandler,
	createWebAuthnStepUpOptionsHandler,
	createWebAuthnStepUpVerifyHandler,
	type WebAuthnLoginOptionsHandlerConfig,
	type WebAuthnLoginVerifyHandlerConfig,
	type WebAuthnListCredentialsHandlerConfig,
	type WebAuthnRemoveCredentialHandlerConfig,
	type WebAuthnRegisterOptionsHandlerConfig,
	type WebAuthnRegisterVerifyHandlerConfig,
	type WebAuthnStepUpOptionsHandlerConfig,
	type WebAuthnStepUpVerifyHandlerConfig
} from '#webauthn-handlers'
import type { AuthConfig, AuthHandlers } from '../types/auth.ts'
import type { User } from '../types/index.ts'
import type { ResolvedDefaults } from './config.ts'
import { createDefaultWebAuthnCredentialMutation } from './credentialMutations.ts'
import type { ResolvedSecurity } from './securitySetup.ts'

export function createWebAuthnHandlers(
	config: AuthConfig,
	defaults: ResolvedDefaults,
	security: ResolvedSecurity
): AuthHandlers['webauthn'] {
	const { adapters, hooks = {}, webauthn, sanitizeUser = (user: User | null) => user } = config
	if (!webauthn) return undefined

	const { urlConfig, autoCreateSession } = defaults
	const removeCredentialMutation =
		config.credentialMutations?.webauthn?.remove ??
		createDefaultWebAuthnCredentialMutation({
			webauthnAdapter: adapters.webauthn!,
			...(webauthn.hooks?.onCredentialDeleted
				? { onCredentialDeleted: webauthn.hooks.onCredentialDeleted }
				: {})
		})
	const registerOptionsConfig: WebAuthnRegisterOptionsHandlerConfig = {
		authorizeSecurityChange: webauthn.authorizeSecurityChange,
		webauthnAdapter: adapters.webauthn!,
		rpID: webauthn.rpID ?? '',
		rpName: webauthn.rpName ?? 'Passkey',
		attestationType: webauthn.attestation === 'indirect' ? 'none' : webauthn.attestation,
		...(webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {}),
		...(webauthn.maxCredentialsPerUser
			? { maxCredentialsPerUser: webauthn.maxCredentialsPerUser }
			: {})
	}
	const registerVerifyConfig: WebAuthnRegisterVerifyHandlerConfig = {
		webauthnAdapter: adapters.webauthn!,
		rpID: webauthn.rpID ?? '',
		origin: webauthn.origin ?? '',
		...(webauthn.maxCredentialsPerUser
			? { maxCredentialsPerUser: webauthn.maxCredentialsPerUser }
			: {}),
		...(webauthn.hooks?.onCredentialCreated
			? { onCredentialCreated: webauthn.hooks.onCredentialCreated }
			: {}),
		...(security.audit.emitter ? { emitSecurityEvent: security.audit.emitter } : {})
	}
	const loginOptionsConfig: WebAuthnLoginOptionsHandlerConfig = {
		webauthnAdapter: adapters.webauthn!,
		rpID: webauthn.rpID ?? '',
		...(webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {})
	}
	const loginVerifyConfig: WebAuthnLoginVerifyHandlerConfig = {
		webauthnAdapter: adapters.webauthn!,
		sessionAdapter: adapters.session,
		rpID: webauthn.rpID ?? '',
		origin: webauthn.origin ?? '',
		redirectAfterLogin: urlConfig.afterLogin,
		autoCreateSession,
		onLoginMode: hooks.onLoginMode ?? 'augment',
		sanitizeUser,
		...(hooks.getSessionMetadata ? { getSessionMetadata: hooks.getSessionMetadata } : {}),
		...(hooks.beforeSessionCreate ? { beforeSessionCreate: hooks.beforeSessionCreate } : {}),
		...(security.audit.emitter ? { emitSecurityEvent: security.audit.emitter } : {}),
		...(adapters.user ? { userAdapter: adapters.user } : {})
	}
	if (hooks.onAuthentication) loginVerifyConfig.onAuthentication = hooks.onAuthentication
	const listCredentialsConfig: WebAuthnListCredentialsHandlerConfig = {
		webauthnAdapter: adapters.webauthn!
	}
	const removeCredentialConfig: WebAuthnRemoveCredentialHandlerConfig = {
		webauthnAdapter: adapters.webauthn!,
		authorizeSecurityChange: webauthn.authorizeSecurityChange,
		mutation: removeCredentialMutation,
		...(security.audit.emitter ? { emitSecurityEvent: security.audit.emitter } : {})
	}
	const stepUpOptionsConfig: WebAuthnStepUpOptionsHandlerConfig = {
		webauthnAdapter: adapters.webauthn!,
		rpID: webauthn.rpID ?? '',
		...(webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {})
	}
	const stepUpVerifyConfig: WebAuthnStepUpVerifyHandlerConfig = {
		webauthnAdapter: adapters.webauthn!,
		sessionAdapter: adapters.session,
		rpID: webauthn.rpID ?? '',
		origin: webauthn.origin ?? '',
		...(security.audit.emitter ? { emitSecurityEvent: security.audit.emitter } : {})
	}

	return {
		registerOptions: createWebAuthnRegisterOptionsHandler(registerOptionsConfig),
		registerVerify: createWebAuthnRegisterVerifyHandler(registerVerifyConfig),
		loginOptions: createWebAuthnLoginOptionsHandler(loginOptionsConfig),
		loginVerify: createWebAuthnLoginVerifyHandler(loginVerifyConfig),
		listCredentials: createWebAuthnListCredentialsHandler(listCredentialsConfig),
		removeCredential: createWebAuthnRemoveCredentialHandler(removeCredentialConfig),
		stepUpOptions: createWebAuthnStepUpOptionsHandler(stepUpOptionsConfig),
		stepUpVerify: createWebAuthnStepUpVerifyHandler(stepUpVerifyConfig)
	}
}
