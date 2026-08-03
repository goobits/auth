import type { WebAuthnAdapter } from '../adapters/webauthn/WebAuthnAdapter.ts'
import { createDefaultWebAuthnCredentialMutation } from '../createAuth/credentialMutations.ts'
import { emitRequestAuthEvent, type AuthEventEmitter } from '../security/events.ts'
import type {
	AuthRequestHandler,
	AuthorizeSecurityChange,
	CredentialMutationPort,
	RequestEventLike,
	WebAuthnCredentialLifecycleInput
} from '../types/auth.ts'
import type { User } from '../types/index.ts'
import { jsonResponse, parseRequestDataWithSchema } from '../utils/http.ts'
import { removeCredentialRequestSchema } from './webauthnUtils.ts'

type ManagementAdapter = Pick<WebAuthnAdapter, 'listCredentials' | 'deleteCredential'>

export type WebAuthnListCredentialsHandlerConfig = {
	webauthnAdapter: ManagementAdapter
	getUser?: (event: RequestEventLike) => User | null | Promise<User | null>
}

export type WebAuthnRemoveCredentialHandlerConfig = WebAuthnListCredentialsHandlerConfig & {
	authorizeSecurityChange: AuthorizeSecurityChange
	onCredentialDeleted?: (input: WebAuthnCredentialLifecycleInput) => Promise<void> | void
	mutation?: NonNullable<CredentialMutationPort['webauthn']>['remove']
	emitSecurityEvent?: AuthEventEmitter
}

function isoDate(value: unknown): string | null {
	if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
		return null
	}
	const date = value instanceof Date ? value : new Date(value)
	return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function credentialSummary(credential: Record<string, unknown>) {
	const credentialId = credential['credentialId']
	if (typeof credentialId !== 'string') return null
	const name = credential['name']
	const transports = credential['transports']
	return {
		credentialId,
		name: typeof name === 'string' ? name : null,
		transports:
			Array.isArray(transports) && transports.every((transport) => typeof transport === 'string')
				? transports
				: null,
		createdAt: isoDate(credential['createdAt']),
		lastUsedAt: isoDate(credential['updatedAt'])
	}
}

async function authenticatedUser(
	event: RequestEventLike,
	getUser: NonNullable<WebAuthnListCredentialsHandlerConfig['getUser']>
): Promise<User | null> {
	const user = await getUser(event)
	const session = event.locals.session
	return user?.id && session?.userId === user.id ? user : null
}

/** Lists public passkey metadata for the current authenticated owner. */
export function createWebAuthnListCredentialsHandler(
	config: WebAuthnListCredentialsHandlerConfig
): AuthRequestHandler {
	const getUser = config.getUser ?? ((event: RequestEventLike) => event.locals.user ?? null)
	return async (event: RequestEventLike) => {
		const user = await authenticatedUser(event, getUser)
		if (!user) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
		const credentials = (await config.webauthnAdapter.listCredentials(user.id))
			.map(credentialSummary)
			.filter((credential) => credential !== null)
		return jsonResponse({ ok: true, credentials })
	}
}

/** Removes only a credential atomically owned by the current authenticated principal. */
export function createWebAuthnRemoveCredentialHandler(
	config: WebAuthnRemoveCredentialHandlerConfig
): AuthRequestHandler {
	const getUser = config.getUser ?? ((event: RequestEventLike) => event.locals.user ?? null)
	const mutation =
		config.mutation ??
		createDefaultWebAuthnCredentialMutation({
			webauthnAdapter: config.webauthnAdapter,
			...(config.onCredentialDeleted ? { onCredentialDeleted: config.onCredentialDeleted } : {})
		})
	return async (event: RequestEventLike) => {
		const user = await authenticatedUser(event, getUser)
		if (!user) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
		const session = event.locals.session
		if (!session) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
		const authorizationRequest = event.request.clone()
		const data = await parseRequestDataWithSchema(event.request, removeCredentialRequestSchema)
		if (!data) return jsonResponse({ ok: false, error: 'Invalid request' }, 400)
		const outcome = await mutation({
			userId: user.id,
			credentialId: data.credentialId,
			session,
			authorizationRequest,
			event,
			authorize: () =>
				config.authorizeSecurityChange({
					action: 'webauthn.remove',
					request: authorizationRequest,
					userId: user.id,
					session
				})
		})
		if (outcome === 'forbidden') {
			return jsonResponse({ ok: false, error: 'Reauthentication required' }, 403)
		}
		if (outcome === 'not-found') {
			return jsonResponse({ ok: false, error: 'Passkey not found' }, 404)
		}
		await emitRequestAuthEvent(config.emitSecurityEvent, event, {
			name: 'webauthn.credential_removed',
			severity: 'info',
			status: 200
		})
		return jsonResponse({ ok: true })
	}
}
