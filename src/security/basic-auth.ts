export type BasicAuthCredentials = {
	username: string;
	password: string;
}

export type BasicAuthPasswordVerifier = (
	storedHash: string,
	password: string
) => Promise<boolean>

export type VerifyBasicAuthOptions = {
	authHeader: string | null;
	getPasswordHash: (username: string) => string | null | undefined | Promise<string | null | undefined>;
	verifyPassword: BasicAuthPasswordVerifier;
}

function decodeBase64(value: string): string {
	const globalWithBuffer = globalThis as typeof globalThis & {
		Buffer?: { from(value: string, encoding: 'base64'): { toString(encoding: 'utf-8'): string } };
	}

	if (globalWithBuffer.Buffer) {
		return globalWithBuffer.Buffer.from(value, 'base64').toString('utf-8')
	}

	const binary = atob(value)
	const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
	return new TextDecoder().decode(bytes)
}

/**
 * Parse an HTTP Basic Authorization header into username/password credentials.
 *
 * @param authHeader - Raw Authorization header value.
 * @returns Parsed credentials, or null when the header is absent or malformed.
 */
export function parseBasicAuthHeader(authHeader: string | null): BasicAuthCredentials | null {
	if (!authHeader?.startsWith('Basic ')) {
		return null
	}

	try {
		const credentials = decodeBase64(authHeader.slice(6))
		const separatorIndex = credentials.indexOf(':')
		if (separatorIndex === -1) {
			return null
		}

		const username = credentials.slice(0, separatorIndex)
		const password = credentials.slice(separatorIndex + 1)
		if (!username || !password) {
			return null
		}

		return { username, password }
	} catch {
		return null
	}
}

/**
 * Verify an HTTP Basic Authorization header against a caller-provided password hash resolver.
 *
 * @param authHeader - auth header value.
 * @param getPasswordHash - get password hash value.
 * @param verifyPassword - verify password value.
 * @returns The authenticated username, or null when verification fails.
 */
export async function verifyBasicAuthHeader({
	authHeader,
	getPasswordHash,
	verifyPassword
}: VerifyBasicAuthOptions): Promise<string | null> {
	const credentials = parseBasicAuthHeader(authHeader)
	if (!credentials) {
		return null
	}

	const storedHash = await getPasswordHash(credentials.username)
	if (!storedHash) {
		return null
	}

	return (await verifyPassword(storedHash, credentials.password)) ? credentials.username : null
}

function sanitizeBasicAuthRealm(realm: string): string {
	return realm.replace(/[\u0000-\u001f\u007f]/g, '').replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

/**
 * Create a standard Basic-auth challenge response.
 *
 * @param realm - realm value.
 * @param body - body value.
 * @returns A 401 Response with a WWW-Authenticate challenge.
 */
export function createBasicAuthResponse({
	realm = 'Authentication Required',
	body = 'Unauthorized'
}: { realm?: string; body?: BodyInit } = {}): Response {
	return new Response(body, {
		status: 401,
		headers: {
			'WWW-Authenticate': `Basic realm="${ sanitizeBasicAuthRealm(realm) }"`
		}
	})
}
