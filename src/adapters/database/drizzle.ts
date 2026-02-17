import { UserAdapter } from "./base.js";
import { and, eq } from "drizzle-orm";
import type { OAuthProfile, User } from "../../types/index.js";
import {
	requireCondition,
	type DrizzleDbLike,
	type DrizzleJson,
	type DrizzleRow,
	type DrizzleTable,
} from "../drizzle-types.js";

type UsersTable = DrizzleTable & {
	id: DrizzleTable[string];
	email: DrizzleTable[string];
	name: DrizzleTable[string];
	avatar?: DrizzleTable[string];
	emailVerified?: DrizzleTable[string];
	password?: DrizzleTable[string];
};

type OAuthAccountsTable = DrizzleTable & {
	userId: DrizzleTable[string];
	provider: DrizzleTable[string];
	providerAccountId: DrizzleTable[string];
};

function toUser(row: DrizzleRow | null): User | null {
	if (!row) return null;
	const id = row["id"];
	const email = row["email"];
	const name = row["name"];
	const avatar = row["avatar"] ?? null;
	const emailVerified = row["emailVerified"] ?? row["email_verified"] ?? false;
	if (typeof id !== "string" && typeof id !== "number") return null;
	if (typeof email !== "string") return null;
	if (typeof name !== "string") return null;
	if (avatar !== null && typeof avatar !== "string") return null;
	if (
		typeof emailVerified !== "boolean" &&
		emailVerified !== 0 &&
		emailVerified !== 1
	) {
		return null;
	}
	return {
		id: String(id),
		email,
		name,
		avatar,
		emailVerified: Boolean(emailVerified),
	};
}

function toDrizzleRow(values: Record<string, DrizzleJson>): DrizzleRow {
	return values;
}

export class DrizzleUserAdapter extends UserAdapter {
	private db: DrizzleDbLike;
	private usersTable: UsersTable;
	private oauthAccountsTable: OAuthAccountsTable | null;
	private sanitizeUser: (user: User | null) => User | null;

	constructor(
		db: DrizzleDbLike,
		options: {
			usersTable?: UsersTable;
			oauthAccountsTable?: OAuthAccountsTable;
			sanitizeUser?: (user: User | null) => User | null;
		} = {},
	) {
		super();
		if (!options.usersTable) {
			throw new Error("DrizzleUserAdapter requires usersTable option");
		}
		this.db = db;
		this.usersTable = options.usersTable;
		this.oauthAccountsTable = options.oauthAccountsTable ?? null;
		this.sanitizeUser = options.sanitizeUser ?? this._defaultSanitizeUser;
	}

	_defaultSanitizeUser(user: User | null): User | null {
		return user;
	}

	async createUser(
		profile: OAuthProfile,
		metadata: Record<string, DrizzleJson> = {},
	): Promise<User> {
		const userData: Record<string, DrizzleJson> = {
			email: profile.email,
			name: profile.name ?? profile.email,
			avatar: profile.picture ?? null,
			emailVerified: Boolean(profile.verified_email),
			...metadata,
		};
		await this.db.insert(this.usersTable).values(toDrizzleRow(userData));
		const user = await this.getUserByEmail(profile.email);
		if (!user) throw new Error("Created user not found");
		return user;
	}

	async getUserById(id: string): Promise<User | null> {
		const [row] = await this.db
			.select()
			.from(this.usersTable)
			.where(eq(this.usersTable.id, id));
		return this.sanitizeUser(toUser(row ?? null));
	}

	async getUserByEmail(email: string): Promise<User | null> {
		const [row] = await this.db
			.select()
			.from(this.usersTable)
			.where(eq(this.usersTable.email, email));
		return this.sanitizeUser(toUser(row ?? null));
	}

	async getUserByProviderId(provider: string, providerId: string): Promise<User | null> {
		if (!this.oauthAccountsTable) {
			throw new Error(
				"OAuth accounts table not configured. Set oauthAccountsTable in adapter options.",
			);
		}
		const [result] = await this.db
			.select({ user: this.usersTable })
			.from(this.oauthAccountsTable)
			.innerJoin(
				this.usersTable,
				eq(this.oauthAccountsTable.userId, this.usersTable.id),
			)
			.where(requireCondition(
				and(
					eq(this.oauthAccountsTable.provider, provider),
					eq(this.oauthAccountsTable.providerAccountId, providerId),
				),
			));
		return this.sanitizeUser(toUser(result?.["user"] ?? null));
	}

	async updateUser(id: string, data: Partial<User> & Record<string, DrizzleJson>): Promise<User> {
		if (Object.keys(data).length > 0) {
			await this.db
				.update(this.usersTable)
				.set(toDrizzleRow(data))
				.where(eq(this.usersTable.id, id));
		}
		const updated = await this.getUserById(id);
		if (!updated) throw new Error("Updated user not found");
		return updated;
	}

	async deleteUser(id: string): Promise<void> {
		await this.db.delete(this.usersTable).where(eq(this.usersTable.id, id));
	}

	async linkOAuthAccount(
		userId: string,
		provider: string,
		providerAccountId: string,
	): Promise<void> {
		if (!this.oauthAccountsTable) {
			throw new Error(
				"OAuth accounts table not configured. Set oauthAccountsTable in adapter options.",
			);
		}
		await this.db.insert(this.oauthAccountsTable).values({
			userId,
			provider,
			providerAccountId,
		});
	}

	async getUserWithPasswordHash(email: string): Promise<(User & { password?: string | null }) | null> {
		const [row] = await this.db
			.select()
			.from(this.usersTable)
			.where(eq(this.usersTable.email, email));
		if (!row) return null;
		const user = toUser(row);
		if (!user) return null;
		const password = row["password"];
		return {
			...user,
			password: typeof password === "string" ? password : null,
		};
	}
}
