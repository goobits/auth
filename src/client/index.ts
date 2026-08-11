import { createCsrfFetch } from '@goobits/security/csrf-client'

import {
	AUTH_ROUTE_PATHS,
	isOAuthProviderName,
	normalizeAuthBasePath,
	resolveAuthRoutePath
} from '../_routePaths.ts'
import { createAccountSecurityClient } from './_accountSecurity.ts'
import { createSessionAndIdentityClient } from './_sessionAndIdentity.ts'
import type {
	AuthClientContext,
	AuthClientEndpoints,
	CreateAuthClientOptions,
	ResolvedAuthClientEndpoints
} from './_types.ts'
import { createPasskeyClient } from './_webauthn.ts'

export type {
	AuthClientEndpoints,
	AuthClientFailure,
	AuthSessionSummary,
	CreateAuthClientOptions,
	MfaActionResult,
	MfaEnrollmentResult,
	MfaStatusResult,
	PasskeyCredentialSummary,
	PasskeyListResult,
	SessionActionResult,
	SessionListResult
} from './_types.ts'
export { supportsConditionalPasskeys, supportsPasskeys } from './_webauthn.ts'

function mergeHeaders(defaults: HeadersInit | undefined, overrides: HeadersInit | undefined): Headers {
	const headers = new Headers(defaults)
	for (const [name, value] of new Headers(overrides)) headers.set(name, value)
	return headers
}

function resolveEndpoints(
	basePath: string,
	endpoints: AuthClientEndpoints
): ResolvedAuthClientEndpoints {
	const endpoint = (configured: string | undefined, path: string) =>
		configured || resolveAuthRoutePath(basePath, path)
	return {
		magicLinkRequest: endpoint(endpoints.magicLinkRequest, AUTH_ROUTE_PATHS.magicLink),
		magicLinkVerify: endpoint(endpoints.magicLinkVerify, AUTH_ROUTE_PATHS.magicLinkVerify),
		passkeyRegisterOptions: endpoint(
			endpoints.passkeyRegisterOptions,
			AUTH_ROUTE_PATHS.passkeyRegisterOptions
		),
		passkeyRegisterVerify: endpoint(
			endpoints.passkeyRegisterVerify,
			AUTH_ROUTE_PATHS.passkeyRegisterVerify
		),
		passkeyLoginOptions: endpoint(
			endpoints.passkeyLoginOptions,
			AUTH_ROUTE_PATHS.passkeyLoginOptions
		),
		passkeyLoginVerify: endpoint(
			endpoints.passkeyLoginVerify,
			AUTH_ROUTE_PATHS.passkeyLoginVerify
		),
		passkeyCredentials: endpoint(
			endpoints.passkeyCredentials,
			AUTH_ROUTE_PATHS.passkeyCredentials
		),
		passkeyStepUpOptions: endpoint(
			endpoints.passkeyStepUpOptions,
			AUTH_ROUTE_PATHS.passkeyStepUpOptions
		),
		passkeyStepUpVerify: endpoint(
			endpoints.passkeyStepUpVerify,
			AUTH_ROUTE_PATHS.passkeyStepUpVerify
		),
		mfaStatus: endpoint(endpoints.mfaStatus, AUTH_ROUTE_PATHS.mfaStatus),
		mfaEnroll: endpoint(endpoints.mfaEnroll, AUTH_ROUTE_PATHS.mfaEnroll),
		mfaVerify: endpoint(endpoints.mfaVerify, AUTH_ROUTE_PATHS.mfaVerify),
		mfaDisable: endpoint(endpoints.mfaDisable, AUTH_ROUTE_PATHS.mfaDisable),
		mfaBackupCode: endpoint(endpoints.mfaBackupCode, AUTH_ROUTE_PATHS.mfaBackupCode),
		mfaStepUp: endpoint(endpoints.mfaStepUp, AUTH_ROUTE_PATHS.mfaStepUp),
		sessions: endpoint(endpoints.sessions, AUTH_ROUTE_PATHS.sessions),
		sessionRevoke:
			endpoints.sessionRevoke || endpoints.sessions || resolveAuthRoutePath(basePath, AUTH_ROUTE_PATHS.sessions),
		oauthIdentities: endpoint(endpoints.oauthIdentities, AUTH_ROUTE_PATHS.oauthIdentities),
		oauthUnlink: endpoint(endpoints.oauthUnlink, AUTH_ROUTE_PATHS.oauthUnlink)
	}
}

function oauthRedirectUrl(
	baseUrl: string,
	basePath: string,
	flowPath: string,
	provider: string,
	returnTo?: string
): string {
	if (!isOAuthProviderName(provider)) throw new Error('Invalid OAuth provider')
	const path = `${baseUrl}${resolveAuthRoutePath(basePath, flowPath)}/${provider}`
	return returnTo ? `${path}?${new URLSearchParams({ returnTo }).toString()}` : path
}

function navigateToOAuth(url: string): string {
	if (typeof window !== 'undefined') window.location.assign(url)
	return url
}

/** Creates the browser-facing Auth client while keeping each protocol in its focused owner. */
export function createAuthClient({
	baseUrl = '',
	basePath = '/auth',
	csrf = {},
	endpoints = {},
	fetcher = fetch,
	headers
}: CreateAuthClientOptions = {}) {
	const authBasePath = normalizeAuthBasePath(basePath)
	const resolved = resolveEndpoints(authBasePath, endpoints)
	const withBase = (path: string) => `${baseUrl}${path}`
	const configuredFetcher: typeof fetch = (input, init = {}) =>
		fetcher(input, { ...init, headers: mergeHeaders(headers, init.headers) })
	const context: AuthClientContext = {
		authFetch: createCsrfFetch({ ...csrf, fetch: configuredFetcher }),
		endpoints: resolved,
		jsonHeaders: { 'content-type': 'application/json' },
		withBase
	}
	const oauthUrl = (flow: string, provider: string, returnTo?: string) =>
		navigateToOAuth(oauthRedirectUrl(baseUrl, authBasePath, flow, provider, returnTo))

	return {
		loginWithOAuth: (provider: string, returnTo?: string) =>
			oauthUrl(AUTH_ROUTE_PATHS.oauthSignIn, provider, returnTo),
		linkOAuth: (provider: string, returnTo?: string) =>
			oauthUrl(AUTH_ROUTE_PATHS.oauthLink, provider, returnTo),
		reauthenticateWithOAuth: (provider: string, returnTo?: string) =>
			oauthUrl(AUTH_ROUTE_PATHS.oauthReauthenticate, provider, returnTo),
		async sendMagicLink({ email, redirectTo }: { email?: string; redirectTo?: string } = {}) {
			const response = await context.authFetch(withBase(resolved.magicLinkRequest), {
				method: 'POST',
				headers: context.jsonHeaders,
				body: JSON.stringify({ email, redirectTo })
			})
			return response.json()
		},
		async verifyMagicLink({
			token,
			otp,
			email
		}: { token?: string; otp?: string; email?: string } = {}) {
			const response = await context.authFetch(withBase(resolved.magicLinkVerify), {
				method: 'POST',
				headers: context.jsonHeaders,
				body: JSON.stringify({ token, otp, email })
			})
			return response.json()
		},
		...createPasskeyClient(context),
		...createAccountSecurityClient(context),
		...createSessionAndIdentityClient(context)
	}
}
