import type { User } from '../../types/index.ts'
import { DrizzleUserAdapter } from '../database/DrizzleUserAdapter.ts'
import type { UserAdapterBundle } from '../database/PasswordCredentialAdapter.ts'
import type { DrizzleDbLike, DrizzleRow, DrizzleTable } from '../drizzleTypes.ts'
import { DrizzleMagicLinkAdapter } from '../magic-link/DrizzleMagicLinkAdapter.ts'
import type { OAuthIdentityAdapter } from '../oauth-identity/OAuthIdentityAdapter.ts'
import { DrizzleTokenAdapter } from '../oauth-token/DrizzleTokenAdapter.ts'
import type { OAuthTokenEncryptionOptions } from '../oauth-token/OAuthTokenCodec.ts'
import { DrizzleSessionAdapter } from '../session/DrizzleSessionAdapter.ts'
import { DrizzleVerificationTokenAdapter } from '../verification-token/DrizzleVerificationTokenAdapter.ts'
import { DrizzleWebAuthnAdapter } from '../webauthn/DrizzleWebAuthnAdapter.ts'

type TableKey =
	| 'users'
	| 'sessions'
	| 'oauthTokens'
	| 'oauthAccounts'
	| 'verificationTokens'
	| 'magicLinkTokens'
	| 'webauthnCredentials'
	| 'webauthnChallenges'

type UserTableShape = DrizzleTable & {
	id: DrizzleTable[string]
	email: DrizzleTable[string]
	name: DrizzleTable[string]
	avatar?: DrizzleTable[string]
	emailVerified?: DrizzleTable[string]
}

type SessionTableShape = DrizzleTable & {
	id: DrizzleTable[string]
	userId: DrizzleTable[string]
	expiresAt: DrizzleTable[string]
	mfaVerifiedAt?: DrizzleTable[string]
}

type OAuthAccountsTableShape = DrizzleTable & {
	userId: DrizzleTable[string]
	provider: DrizzleTable[string]
	providerAccountId: DrizzleTable[string]
}

type OAuthTokensTableShape = DrizzleTable & {
	userId: DrizzleTable[string]
	provider: DrizzleTable[string]
	tokens: DrizzleTable[string]
}

type VerificationTokensTableShape = DrizzleTable & {
	id: DrizzleTable[string]
	userId: DrizzleTable[string]
	type: DrizzleTable[string]
	token: DrizzleTable[string]
	expiresAt: DrizzleTable[string]
	metadata: DrizzleTable[string]
}

/** Drizzle Auth Schema typed model for runtime integration. */
export type DrizzleAuthSchema = Partial<Record<TableKey, DrizzleTable>>

/** Drizzle Adapter Options typed model for runtime integration. */
export type DrizzleAdapterOptions<TSchema extends DrizzleAuthSchema = DrizzleAuthSchema> = {
	schema?: TSchema
	tables?: Partial<Record<TableKey, DrizzleTable>>
	oauthTokenEncryption?: OAuthTokenEncryptionOptions
	session?: {
		sessionLifetime?: number
		sessionRefreshThreshold?: number
		cookieName?: string
		secureCookies?: boolean
		mapUser?: (row: DrizzleRow | null) => User | null
	}
	sanitizeUser?: (user: User | null) => User | null
}

/** Drizzle Adapter Bundle typed model for runtime integration. */
export type DrizzleAdapterBundle = UserAdapterBundle & {
	session: DrizzleSessionAdapter
	oauthIdentity?: OAuthIdentityAdapter
	oauthToken?: DrizzleTokenAdapter
	verificationToken?: DrizzleVerificationTokenAdapter
	magicLink?: DrizzleMagicLinkAdapter
	webauthn?: DrizzleWebAuthnAdapter
}

function getTable(key: TableKey, options: DrizzleAdapterOptions): DrizzleTable | undefined {
	const explicit = options.tables?.[key]
	if (explicit) return explicit
	return options.schema?.[key]
}

function requireTable(key: TableKey, options: DrizzleAdapterOptions): DrizzleTable {
	const found = getTable(key, options)
	if (!found) {
		throw new Error(
			`drizzleAdapter requires '${key}' table. Pass it via options.schema.${key} or options.tables.${key}.`
		)
	}
	return found
}

/** Processes adapter for auth storage. */
export function drizzleAdapter<TSchema extends DrizzleAuthSchema = DrizzleAuthSchema>(
	db: DrizzleDbLike,
	options: DrizzleAdapterOptions<TSchema> = {}
): DrizzleAdapterBundle {
	const usersTable = requireTable('users', options) as UserTableShape
	const sessionsTable = requireTable('sessions', options) as SessionTableShape
	const oauthAccountsTable = getTable('oauthAccounts', options) as
		| OAuthAccountsTableShape
		| undefined

	const user = new DrizzleUserAdapter(db, {
		usersTable,
		...(oauthAccountsTable ? { oauthAccountsTable } : {}),
		...(options.sanitizeUser ? { sanitizeUser: options.sanitizeUser } : {})
	})

	const session = new DrizzleSessionAdapter(db, {
		sessionsTable,
		usersTable,
		...(options.session?.sessionLifetime !== undefined
			? { sessionLifetime: options.session.sessionLifetime }
			: {}),
		...(options.session?.sessionRefreshThreshold !== undefined
			? { sessionRefreshThreshold: options.session.sessionRefreshThreshold }
			: {}),
		...(options.session?.cookieName !== undefined
			? { cookieName: options.session.cookieName }
			: {}),
		...(options.session?.secureCookies !== undefined
			? { secureCookies: options.session.secureCookies }
			: {}),
		...(options.session?.mapUser ? { mapUser: options.session.mapUser } : {}),
		...(options.sanitizeUser ? { sanitizeUser: options.sanitizeUser } : {})
	})

	const oauthTokensTable = getTable('oauthTokens', options) as OAuthTokensTableShape | undefined
	const oauthToken = oauthTokensTable
		? new DrizzleTokenAdapter(db, {
				tokensTable: oauthTokensTable,
				...(options.oauthTokenEncryption ?? {})
			})
		: undefined

	const verificationTokensTable = getTable('verificationTokens', options) as
		| VerificationTokensTableShape
		| undefined
	const verificationToken = verificationTokensTable
		? new DrizzleVerificationTokenAdapter(db, {
				tokensTable: verificationTokensTable,
				usersTable
			})
		: undefined

	const magicLinkTokensTable = getTable('magicLinkTokens', options)
	const magicLink = magicLinkTokensTable
		? new DrizzleMagicLinkAdapter(db, { tokensTable: magicLinkTokensTable })
		: undefined

	const webauthnCredentials = getTable('webauthnCredentials', options)
	const webauthnChallenges = getTable('webauthnChallenges', options)
	const webauthn =
		webauthnCredentials && webauthnChallenges
			? new DrizzleWebAuthnAdapter(db, {
					credentialsTable: webauthnCredentials,
					challengesTable: webauthnChallenges
				})
			: undefined

	return {
		session,
		user,
		passwordCredential: user,
		...(oauthAccountsTable ? { oauthIdentity: user } : {}),
		...(oauthToken ? { oauthToken } : {}),
		...(verificationToken ? { verificationToken } : {}),
		...(magicLink ? { magicLink } : {}),
		...(webauthn ? { webauthn } : {})
	}
}
