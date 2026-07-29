import type { Cookies } from '@sveltejs/kit'

type CookieSession = {
	id: string
	expiresAt: Date
}

export function writeSessionCookie(
	cookies: Cookies,
	session: CookieSession,
	cookieName: string,
	secureCookies: boolean,
	cookieDomain?: string
): void {
	cookies.set(cookieName, session.id, {
		...(cookieDomain ? { domain: cookieDomain } : {}),
		expires: session.expiresAt,
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: secureCookies
	})
}

export function clearSessionCookie(
	cookies: Cookies,
	cookieName: string,
	cookieDomain?: string
): void {
	cookies.delete(cookieName, {
		...(cookieDomain ? { domain: cookieDomain } : {}),
		path: '/'
	})
}
