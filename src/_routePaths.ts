export const AUTH_ROUTE_PATHS = {
	magicLink: '/magic-link',
	magicLinkVerify: '/magic-link/verify',
	passkeyRegisterOptions: '/passkey/register/options',
	passkeyRegisterVerify: '/passkey/register/verify',
	passkeyLoginOptions: '/passkey/login/options',
	passkeyLoginVerify: '/passkey/login/verify',
	mfaStatus: '/mfa/status',
	mfaEnroll: '/mfa/enroll',
	mfaVerify: '/mfa/verify',
	mfaDisable: '/mfa/disable',
	mfaBackupCode: '/mfa/backup-code',
	mfaStepUp: '/mfa/step-up',
	sessions: '/sessions'
} as const

export function resolveAuthRoutePath(basePath: string, routePath: string): string {
	const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
	return `${base}${routePath}`
}

export function matchesAuthRoute(segments: string[], routePath: string): boolean {
	return segments.join('/') === routePath.slice(1)
}
