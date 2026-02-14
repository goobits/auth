export function getStringEnv(
	source: Record<string, string | undefined>,
	key: string,
	fallback = ''
) {
	const value = source[key]
	return typeof value === 'string' && value.length > 0 ? value : fallback
}

export function getRuntimeEnv(source: Record<string, string | undefined>) {
	return {
		host: getStringEnv(source, 'HOST', '0.0.0.0'),
		httpsCert: source['HTTPS_CERT'],
		httpsKey: source['HTTPS_KEY'],
		port: Number(getStringEnv(source, 'PORT', '3610')),
		recaptchaSiteKey: getStringEnv(source, 'RECAPTCHA_SITE_KEY', '')
	}
}
