export const AUTH_ROUTE_PATHS = {
	oauthSignIn: '/signin',
	oauthLink: '/link',
	oauthReauthenticate: '/reauth',
	oauthCallback: '/callback',
	signOut: '/signout',
	magicLink: '/magic-link',
	magicLinkVerify: '/magic-link/verify',
	passkeyRegisterOptions: '/passkey/register/options',
	passkeyRegisterVerify: '/passkey/register/verify',
	passkeyLoginOptions: '/passkey/login/options',
	passkeyLoginVerify: '/passkey/login/verify',
	passkeyCredentials: '/passkey/credentials',
	passkeyStepUpOptions: '/passkey/step-up/options',
	passkeyStepUpVerify: '/passkey/step-up/verify',
	mfaStatus: '/mfa/status',
	mfaEnroll: '/mfa/enroll',
	mfaVerify: '/mfa/verify',
	mfaDisable: '/mfa/disable',
	mfaBackupCode: '/mfa/backup-code',
	mfaStepUp: '/mfa/step-up',
	sessions: '/sessions',
	oauthIdentities: '/oauth/identities',
	oauthUnlink: '/oauth/unlink'
} as const

/** Validates the stable, URL-safe provider names accepted by OAuth routes and config. */
export function isOAuthProviderName(value: string): boolean {
	return /^[a-z][a-z0-9-]{0,31}$/u.test(value)
}

/** Normalizes an absolute auth mount path shared by server and browser integrations. */
export function normalizeAuthBasePath(value: string): string {
	const trimmed = value.trim()
	if (trimmed === '' || trimmed === '/') return ''
	if (
		!trimmed.startsWith('/') ||
		trimmed.includes('//') ||
		trimmed.includes('\\') ||
		trimmed.includes('?') ||
		trimmed.includes('#') ||
		/[\u0000-\u001f\u007f]/u.test(trimmed)
	) {
		throw new Error('Invalid auth base path')
	}

	const normalized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
	for (const segment of normalized.slice(1).split('/')) {
		let decoded: string
		try {
			decoded = decodeURIComponent(segment)
		} catch {
			throw new Error('Invalid auth base path')
		}
		if (
			decoded === '.' ||
			decoded === '..' ||
			decoded.includes('/') ||
			decoded.includes('\\') ||
			/[\u0000-\u001f\u007f]/u.test(decoded)
		) {
			throw new Error('Invalid auth base path')
		}
	}
	return normalized
}

export function resolveAuthRoutePath(basePath: string, routePath: string): string {
	const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
	return `${base}${routePath}`
}

export function matchesAuthRoute(segments: string[], routePath: string): boolean {
	return segments.join('/') === routePath.slice(1)
}
