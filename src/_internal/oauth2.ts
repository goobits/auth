import { bytesToBase64Url, sha256Bytes } from '@goobits/security/crypto'

const OAUTH_RESPONSE_MAX_BYTES = 64 * 1024
const OAUTH_REQUEST_TIMEOUT_MS = 10_000

export type OAuthTokenSet = {
	accessToken: string
	refreshToken: string | null
	scope: string | null
	expiresIn: number
	idToken: string | null
}

/** Reads an HTTP response without allowing an untrusted peer to exhaust memory. */
export async function readBoundedResponseText(
	response: Response,
	maxBytes: number,
	label: string
): Promise<string> {
	const contentLength = response.headers.get('content-length')
	if (contentLength && /^\d+$/u.test(contentLength) && Number(contentLength) > maxBytes) {
		throw new Error(`${label} is too large`)
	}
	if (!response.body) return ''

	const reader = response.body.getReader()
	const chunks: Uint8Array[] = []
	let totalBytes = 0
	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			if (!value) continue
			totalBytes += value.byteLength
			if (totalBytes > maxBytes) {
				await reader.cancel()
				throw new Error(`${label} is too large`)
			}
			chunks.push(value)
		}
	} finally {
		reader.releaseLock()
	}

	const body = new Uint8Array(totalBytes)
	let offset = 0
	for (const chunk of chunks) {
		body.set(chunk, offset)
		offset += chunk.byteLength
	}
	return new TextDecoder().decode(body)
}

/** A bounded, provider-safe OAuth token endpoint rejection. */
export class OAuth2RequestError extends Error {
	readonly code: string
	readonly description: string | null
	readonly status: number

	constructor(code: string, description: string | null, status: number) {
		super(description ? `${code}: ${description}` : code)
		this.name = 'OAuth2RequestError'
		this.code = code
		this.description = description
		this.status = status
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null
}

/** Derives the RFC 7636 S256 challenge for an OAuth PKCE verifier. */
export async function createS256CodeChallenge(codeVerifier: string): Promise<string> {
	return bytesToBase64Url(await sha256Bytes(codeVerifier))
}

/** Exchanges form-encoded OAuth credentials for one strictly validated token set. */
export async function requestOAuthTokens(
	endpoint: string,
	parameters: URLSearchParams
): Promise<OAuthTokenSet> {
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/x-www-form-urlencoded'
		},
		body: parameters,
		signal: AbortSignal.timeout(OAUTH_REQUEST_TIMEOUT_MS)
	})
	const responseText = await readBoundedResponseText(
		response,
		OAUTH_RESPONSE_MAX_BYTES,
		'OAuth token response'
	)

	let responseBody: unknown
	try {
		responseBody = JSON.parse(responseText)
	} catch {
		if (!response.ok) {
			throw new OAuth2RequestError(`http_${response.status}`, null, response.status)
		}
		throw new Error('OAuth token response is not valid JSON')
	}
	if (!isRecord(responseBody)) {
		throw new Error('OAuth token response is invalid')
	}

	const errorCode = optionalString(responseBody['error'])
	const errorDescription = optionalString(responseBody['error_description'])
	if (!response.ok || errorCode) {
		throw new OAuth2RequestError(
			errorCode ?? `http_${response.status}`,
			errorDescription,
			response.status
		)
	}

	const accessToken = optionalString(responseBody['access_token'])
	if (!accessToken) throw new Error('OAuth token response is missing an access token')
	const expiresInValue = responseBody['expires_in'] ?? 0
	if (
		typeof expiresInValue !== 'number' ||
		!Number.isFinite(expiresInValue) ||
		expiresInValue < 0
	) {
		throw new Error('OAuth token response has an invalid expiry')
	}

	return {
		accessToken,
		refreshToken: optionalString(responseBody['refresh_token']),
		scope: optionalString(responseBody['scope']),
		expiresIn: expiresInValue,
		idToken: optionalString(responseBody['id_token'])
	}
}

/** Revokes one OAuth credential with bounded, structured, idempotent error handling. */
export async function requestOAuthTokenRevocation(options: {
	endpoint: string
	parameters: URLSearchParams
	terminalErrorCodes: readonly string[]
}): Promise<void> {
	const response = await fetch(options.endpoint, {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/x-www-form-urlencoded'
		},
		body: options.parameters,
		signal: AbortSignal.timeout(OAUTH_REQUEST_TIMEOUT_MS)
	})
	if (response.ok) return

	const responseText = await readBoundedResponseText(
		response,
		OAUTH_RESPONSE_MAX_BYTES,
		'OAuth revocation response'
	)
	let code = `http_${response.status}`
	let description: string | null = null
	try {
		const body: unknown = JSON.parse(responseText)
		if (isRecord(body)) {
			code = optionalString(body['error']) ?? code
			description = optionalString(body['error_description'])
		}
	} catch {
		// A non-JSON provider failure retains the bounded HTTP status code.
	}
	if (response.status === 400 && options.terminalErrorCodes.includes(code)) return
	throw new OAuth2RequestError(code, description, response.status)
}
