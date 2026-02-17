import { env } from '$env/dynamic/private';
import { raise } from '$lib/server/http-error';

type TurnstileResponse = {
	success: boolean;
	'action'?: string;
	'error-codes'?: string[];
};

type TurnstileEnv = {
	TURNSTILE_SECRET_KEY?: string;
	TURNSTILE_BYPASS?: string;
};

async function verifyToken(secret: string, token: string, ip: string | null): Promise<TurnstileResponse> {
	const body = new URLSearchParams({
		secret,
		response: token
	});

	if (ip) body.set('remoteip', ip);

	const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		body
	});

	if (!response.ok) {
		raise(502, 'Turnstile verification request failed.');
	}

	return (await response.json()) as TurnstileResponse;
}

export async function assertTurnstile(
	request: Request,
	form: FormData,
	expectedAction: 'join' | 'volunteer' | 'remind',
	runtimeEnv?: TurnstileEnv
): Promise<void> {
	const host = new URL(request.url).hostname;
	const hostHeader = request.headers.get('host') ?? '';
	const isLocalHost =
		host === '127.0.0.1' ||
		host === 'localhost' ||
		host === '0.0.0.0' ||
		hostHeader.startsWith('127.0.0.1') ||
		hostHeader.startsWith('localhost') ||
		hostHeader.startsWith('0.0.0.0');
	if (isLocalHost) return;
	if ((runtimeEnv?.TURNSTILE_BYPASS ?? env.TURNSTILE_BYPASS) === 'true') return;
	const secret = runtimeEnv?.TURNSTILE_SECRET_KEY ?? env.TURNSTILE_SECRET_KEY;
	if (!secret) {
		raise(500, 'Turnstile is not configured. Missing TURNSTILE_SECRET_KEY.');
	}

	const tokenEntry = form.get('cf-turnstile-response');
	if (typeof tokenEntry !== 'string' || tokenEntry.trim().length === 0) {
		raise(400, 'Please complete the anti-bot check.');
	}

	const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for');
	const result = await verifyToken(secret, tokenEntry.trim(), ip);

	if (!result.success) {
		raise(400, 'Anti-bot verification failed.');
	}

	if (result.action && result.action !== expectedAction) {
		raise(400, 'Invalid anti-bot action.');
	}
}
