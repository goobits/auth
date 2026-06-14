import { type RecaptchaOptions as SecurityRecaptchaOptions, verifyRecaptcha } from '@goobits/security/recaptcha'

type RecaptchaOptions = {
	secretKey?: string;
	action?: string | null;
	minScore?: number;
	timeoutMs?: number;
	allowInDevelopment?: boolean;
}

export async function verifyRecaptchaToken(
	token: string | null,
	options: RecaptchaOptions = {}
): Promise<boolean> {
	const {
		secretKey,
		action = null,
		minScore = 0.5,
		timeoutMs = 5000,
		allowInDevelopment = true
	} = options

	const verifyOptions: SecurityRecaptchaOptions = {
		minScore,
		timeoutMs,
		allowInDevelopment
	}
	if (secretKey !== undefined) verifyOptions.secretKey = secretKey
	if (action) verifyOptions.action = action

	const result = await verifyRecaptcha(token, verifyOptions)
	return result.success
}
