import { DrizzleUserAdapter } from "../database/drizzle.js";
import { DrizzleSessionAdapter } from "../session/drizzle.js";
import { DrizzleTokenAdapter } from "../oauth-token/drizzle.js";
import { DrizzleVerificationTokenAdapter } from "../verification-token/drizzle-verification.js";
import { DrizzleMagicLinkAdapter } from "../magic-link/drizzle.js";
import { DrizzleWebAuthnAdapter } from "../webauthn/drizzle.js";
import type { DrizzleDbLike, DrizzleTable } from "../drizzle-types.js";
import type { User } from "../../types/index.js";

type TableKey =
	| "users"
	| "sessions"
	| "oauthTokens"
	| "oauthAccounts"
	| "verificationTokens"
	| "magicLinkTokens"
	| "webauthnCredentials"
	| "webauthnChallenges";

type UserTableShape = DrizzleTable & {
	id: DrizzleTable[string];
	email: DrizzleTable[string];
	name: DrizzleTable[string];
	avatar?: DrizzleTable[string];
	emailVerified?: DrizzleTable[string];
};

type SessionTableShape = DrizzleTable & {
	id: DrizzleTable[string];
	userId: DrizzleTable[string];
	expiresAt: DrizzleTable[string];
};

type OAuthAccountsTableShape = DrizzleTable & {
	userId: DrizzleTable[string];
	provider: DrizzleTable[string];
	providerAccountId: DrizzleTable[string];
};

type OAuthTokensTableShape = DrizzleTable & {
	userId: DrizzleTable[string];
	provider: DrizzleTable[string];
	tokens: DrizzleTable[string];
};

type VerificationTokensTableShape = DrizzleTable & {
	id: DrizzleTable[string];
	userId: DrizzleTable[string];
	type: DrizzleTable[string];
	token: DrizzleTable[string];
	expiresAt: DrizzleTable[string];
};

export type DrizzleAuthSchema = Partial<Record<TableKey, DrizzleTable>>;

export type DrizzleAdapterOptions<TSchema extends DrizzleAuthSchema = DrizzleAuthSchema> = {
	schema?: TSchema;
	tables?: Partial<Record<TableKey, DrizzleTable>>;
	oauthTokenEncryptionKey?: string | null;
	oauthTokenEncrypt?: boolean;
	session?: {
		sessionLifetime?: number;
		sessionRefreshThreshold?: number;
		cookieName?: string;
		secureCookies?: boolean;
	};
	sanitizeUser?: (user: User | null) => User | null;
};

export type DrizzleAdapterBundle = {
	session: DrizzleSessionAdapter;
	user: DrizzleUserAdapter;
	oauthToken?: DrizzleTokenAdapter;
	verificationToken?: DrizzleVerificationTokenAdapter;
	magicLink?: DrizzleMagicLinkAdapter;
	webauthn?: DrizzleWebAuthnAdapter;
};

function getTable(
	key: TableKey,
	options: DrizzleAdapterOptions,
): DrizzleTable | undefined {
	const explicit = options.tables?.[key];
	if (explicit) return explicit;
	return options.schema?.[key];
}

function requireTable(
	key: TableKey,
	options: DrizzleAdapterOptions,
): DrizzleTable {
	const found = getTable(key, options);
	if (!found) {
		throw new Error(
			`drizzleAdapter requires '${key}' table. Pass it via options.schema.${key} or options.tables.${key}.`,
		);
	}
	return found;
}

export function drizzleAdapter<TSchema extends DrizzleAuthSchema = DrizzleAuthSchema>(
	db: DrizzleDbLike,
	options: DrizzleAdapterOptions<TSchema> = {},
): DrizzleAdapterBundle {
	const usersTable = requireTable("users", options) as UserTableShape;
	const sessionsTable = requireTable("sessions", options) as SessionTableShape;
	const oauthAccountsTable = getTable("oauthAccounts", options) as OAuthAccountsTableShape | undefined;

	const user = new DrizzleUserAdapter(db, {
		usersTable,
		...(oauthAccountsTable ? { oauthAccountsTable } : {}),
		...(options.sanitizeUser ? { sanitizeUser: options.sanitizeUser } : {}),
	});

	const session = new DrizzleSessionAdapter(db, {
		sessionsTable,
		usersTable,
		...(options.session?.sessionLifetime !== undefined
			? { sessionLifetime: options.session.sessionLifetime }
			: {}),
		...(options.session?.sessionRefreshThreshold !== undefined
			? { sessionRefreshThreshold: options.session.sessionRefreshThreshold }
			: {}),
		...(options.session?.cookieName !== undefined ? { cookieName: options.session.cookieName } : {}),
		...(options.session?.secureCookies !== undefined
			? { secureCookies: options.session.secureCookies }
			: {}),
		...(options.sanitizeUser ? { sanitizeUser: options.sanitizeUser } : {}),
	});

	const oauthTokensTable = getTable("oauthTokens", options) as OAuthTokensTableShape | undefined;
	const oauthToken = oauthTokensTable
		? new DrizzleTokenAdapter(db, {
				tokensTable: oauthTokensTable,
				...(options.oauthTokenEncryptionKey !== undefined
					? { encryptionKey: options.oauthTokenEncryptionKey }
					: {}),
				encrypt:
					options.oauthTokenEncrypt ??
					(typeof options.oauthTokenEncryptionKey === "string" &&
						options.oauthTokenEncryptionKey.length > 0),
		  })
		: undefined;

	const verificationTokensTable = getTable("verificationTokens", options) as
		| VerificationTokensTableShape
		| undefined;
	const verificationToken = verificationTokensTable
		? new DrizzleVerificationTokenAdapter(db, {
				tokensTable: verificationTokensTable,
				usersTable,
		  })
		: undefined;

	const magicLinkTokensTable = getTable("magicLinkTokens", options);
	const magicLink = magicLinkTokensTable
		? new DrizzleMagicLinkAdapter(db, { tokensTable: magicLinkTokensTable })
		: undefined;

	const webauthnCredentials = getTable("webauthnCredentials", options);
	const webauthnChallenges = getTable("webauthnChallenges", options);
	const webauthn =
		webauthnCredentials && webauthnChallenges
			? new DrizzleWebAuthnAdapter(db, {
					credentialsTable: webauthnCredentials,
					challengesTable: webauthnChallenges,
			  })
			: undefined;

	return {
		session,
		user,
		...(oauthToken ? { oauthToken } : {}),
		...(verificationToken ? { verificationToken } : {}),
		...(magicLink ? { magicLink } : {}),
		...(webauthn ? { webauthn } : {}),
	};
}
