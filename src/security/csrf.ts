import type { Cookies } from '@sveltejs/kit'
import {
	CSRF_COOKIE_NAME,
	CSRF_HEADER_NAME,
	type CsrfTokenStore,
	MemoryCsrfStore
} from '@goobits/security/csrf'
import { createSvelteKitCsrf } from '@goobits/security/csrf/sveltekit'

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, MemoryCsrfStore }

type CookiesLike = Pick<Cookies, 'set' | 'get' | 'delete'>

export type CsrfStore = CsrfTokenStore

/** Processes csrf token for auth security checks. */
export async function issueCsrfToken({
	cookies,
	store,
	ttlMs = 60 * 60 * 1000,
	cookieName = CSRF_COOKIE_NAME,
	secure = true,
	httpOnly = false,
	sameSite = 'lax',
	path = '/'
}: {
	cookies?: CookiesLike
	store?: CsrfStore
	ttlMs?: number
	cookieName?: string
	secure?: boolean
	httpOnly?: boolean
	sameSite?: 'lax' | 'strict' | 'none'
	path?: string
} = {}): Promise<string> {
	if (!cookies) {
		throw new Error('issueCsrfToken requires cookies')
	}

	const csrf = createSvelteKitCsrf({
		cookieName,
		headerName: CSRF_HEADER_NAME,
		tokenFieldName: '_csrf',
		tokenExpiryMs: ttlMs,
		trackExpiry: true,
		cookieOptions: {
			httpOnly,
			secure,
			sameSite,
			path,
			maxAge: Math.floor(ttlMs / 1000)
		},
		...(store ? { tokenStore: store } : {})
	})
	return csrf.issue(cookies, { expiryMs: ttlMs })
}

/** Validates csrf request for auth security checks. */
export async function validateCsrfRequest({
	request,
	cookies,
	store,
	headerName = CSRF_HEADER_NAME,
	cookieName = CSRF_COOKIE_NAME,
	checkExpiry = false
}: {
	request?: Request
	cookies?: CookiesLike
	store?: CsrfStore
	headerName?: string
	cookieName?: string
	checkExpiry?: boolean
} = {}): Promise<boolean> {
	if (!request || !cookies) {
		throw new Error('validateCsrfRequest requires request and cookies')
	}

	const csrf = createSvelteKitCsrf({
		cookieName,
		headerName,
		tokenFieldName: '_csrf',
		checkExpiry,
		...(store ? { tokenStore: store } : {})
	})
	return csrf.validateRequest(request, cookies)
}
