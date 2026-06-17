import type { Cookies } from '@sveltejs/kit'
import {
	CSRF_COOKIE_NAME,
	CSRF_HEADER_NAME,
	createCsrf,
	type CsrfTokenStore,
	MemoryCsrfStore
} from '@goobits/security/csrf'

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
	cookies?: CookiesLike;
	store?: CsrfStore;
	ttlMs?: number;
	cookieName?: string;
	secure?: boolean;
	httpOnly?: boolean;
	sameSite?: 'lax' | 'strict' | 'none';
	path?: string;
} = {}): Promise<string> {
	if (!cookies) {
		throw new Error('issueCsrfToken requires cookies')
	}

	const csrf = createCsrf({
		cookieName,
		headerName: CSRF_HEADER_NAME,
		tokenExpiryMs: ttlMs,
		cookieOptions: {
			httpOnly,
			secure,
			sameSite,
			path,
			maxAge: Math.floor(ttlMs / 1000)
		},
		...(store ? { tokenStore: store } : {})
	})
	const token = await csrf.generate({ expiryMs: ttlMs })

	cookies.set(cookieName, token, {
		httpOnly,
		secure,
		sameSite,
		path,
		maxAge: Math.floor(ttlMs / 1000)
	})

	return token
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
	request?: Request;
	cookies?: CookiesLike;
	store?: CsrfStore;
	headerName?: string;
	cookieName?: string;
	checkExpiry?: boolean;
} = {}): Promise<boolean> {
	if (!request || !cookies) {
		throw new Error('validateCsrfRequest requires request and cookies')
	}

	const headerToken = request.headers.get(headerName) || ''
	const cookieToken = cookies.get(cookieName) || ''
	const headers = new Headers()
	headers.set(headerName, headerToken)
	headers.set('cookie', `${ cookieName }=${ cookieToken }`)
	const csrf = createCsrf({
		cookieName,
		headerName,
		...(store ? { tokenStore: store } : {})
	})
	return csrf.validate(new Request(request.url, { headers }), { checkExpiry })
}
