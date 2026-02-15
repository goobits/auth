const DISPOSABLE_DOMAINS = new Set([
	'mailinator.com',
	'guerrillamail.com',
	'10minutemail.com',
	'tempmail.com',
	'temp-mail.org',
	'yopmail.com',
	'fakeinbox.com',
	'sharklasers.com'
])

export type DisposableMode = 'off' | 'score' | 'block'

export function getEmailDomain(email: string) {
	const at = email.lastIndexOf('@')
	if (at < 0) return ''
	return email.slice(at + 1).trim().toLowerCase()
}

export function isDisposableEmailDomain(email: string) {
	const domain = getEmailDomain(email)
	if (!domain) return false
	return DISPOSABLE_DOMAINS.has(domain)
}
