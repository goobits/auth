export type TurnstileVerificationResult = {
	success: boolean
	action?: string
	hostname?: string
	challenge_ts?: string
	errorCodes: string[]
	metadata?: { interactive?: boolean }
}

type TurnstileApiResponse = {
	success?: boolean
	action?: string
	hostname?: string
	challenge_ts?: string
	metadata?: { interactive?: boolean }
	['error-codes']?: string[]
}

export async function verifyTurnstileToken({
	secret,
	token,
	remoteIp
}: {
	secret: string
	token: string
	remoteIp?: string
}): Promise<TurnstileVerificationResult> {
	if (!secret || !token) {
		return { success: false, errorCodes: ['missing-input'] }
	}

	const body = new URLSearchParams({
		secret,
		response: token
	})
	if (remoteIp) body.set('remoteip', remoteIp)

	let json: TurnstileApiResponse | null = null
	try {
		const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: body.toString()
		})
		json = (await response.json()) as TurnstileApiResponse
	} catch {
		return { success: false, errorCodes: ['network-error'] }
	}

	return {
		success: Boolean(json?.success),
		...(typeof json?.action === 'string' ? { action: json.action } : {}),
		...(typeof json?.hostname === 'string' ? { hostname: json.hostname } : {}),
		...(typeof json?.challenge_ts === 'string' ? { challenge_ts: json.challenge_ts } : {}),
		...(json?.metadata ? { metadata: json.metadata } : {}),
		errorCodes: Array.isArray(json?.['error-codes']) ? json['error-codes'] : []
	}
}
