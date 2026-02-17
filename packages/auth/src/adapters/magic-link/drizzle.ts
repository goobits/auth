import { and, eq } from "drizzle-orm";
import { MagicLinkAdapter } from "./base.js";
import type { MagicLinkToken } from "../../types/index.js";
import {
	requireCondition,
	requireColumn,
	type DrizzleDbLike,
	type DrizzleJson,
	type DrizzleRow,
	type DrizzleTable,
} from "../drizzle-types.js";

type TokensTable = DrizzleTable;

function mapTokenRow(row: DrizzleRow | null, columns: {
	id: string;
	userId: string;
	email: string;
	tokenHash: string;
	otpHash: string;
	expiresAt: string;
	createdAt: string;
}): MagicLinkToken | null {
	if (!row) return null;
	const id = row[columns.id];
	const userId = row[columns.userId] ?? null;
	const email = row[columns.email];
	const tokenHash = row[columns.tokenHash];
	const otpHash = row[columns.otpHash] ?? null;
	const expiresAt = row[columns.expiresAt];
	const createdAt = row[columns.createdAt];
	if (typeof id !== "string") return null;
	if (userId !== null && typeof userId !== "string" && typeof userId !== "number") return null;
	if (typeof email !== "string") return null;
	if (typeof tokenHash !== "string") return null;
	if (otpHash !== null && typeof otpHash !== "string") return null;
	if (!(expiresAt instanceof Date) && typeof expiresAt !== "string") return null;
	const expiresAtDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
	if (Number.isNaN(expiresAtDate.getTime())) return null;
	const createdAtDate =
		createdAt instanceof Date
			? createdAt
			: typeof createdAt === "string"
				? new Date(createdAt)
				: new Date();
	return {
		id,
		userId: userId === null ? null : String(userId),
		email,
		tokenHash,
		otpHash,
		expiresAt: expiresAtDate,
		createdAt: Number.isNaN(createdAtDate.getTime()) ? new Date() : createdAtDate,
	};
}

export class DrizzleMagicLinkAdapter extends MagicLinkAdapter {
	private db: DrizzleDbLike;
	private tokensTable: TokensTable;
	private columns: {
		id: string;
		userId: string;
		email: string;
		tokenHash: string;
		otpHash: string;
		expiresAt: string;
		createdAt: string;
	};

	constructor(
		db: DrizzleDbLike,
		options: {
			tokensTable?: TokensTable;
			columns?: Partial<Record<string, string>>;
		} = {},
	) {
		super();
		if (!options.tokensTable) {
			throw new Error("DrizzleMagicLinkAdapter requires tokensTable option");
		}
		this.db = db;
		this.tokensTable = options.tokensTable;
		this.columns = {
			id: options.columns?.["id"] || "id",
			userId: options.columns?.["userId"] || "userId",
			email: options.columns?.["email"] || "email",
			tokenHash: options.columns?.["tokenHash"] || "tokenHash",
			otpHash: options.columns?.["otpHash"] || "otpHash",
			expiresAt: options.columns?.["expiresAt"] || "expiresAt",
			createdAt: options.columns?.["createdAt"] || "createdAt",
		};
	}

	async createToken({
		userId,
		email,
		tokenHash,
		otpHash,
		expiresAt,
		metadata,
	}: {
		userId: string | null;
		email: string;
		tokenHash: string;
		otpHash?: string | null;
		expiresAt: Date;
		metadata?: Record<string, DrizzleJson>;
	}): Promise<MagicLinkToken> {
		const values: DrizzleRow = {
			[this.columns.userId]: userId,
			[this.columns.email]: email,
			[this.columns.tokenHash]: tokenHash,
			[this.columns.otpHash]: otpHash ?? null,
			[this.columns.expiresAt]: expiresAt,
			...(metadata ?? {}),
		};
		await this.db.insert(this.tokensTable).values(values);
		const found = await this.findByTokenHash(tokenHash);
		if (found) return found;
		return {
			id: crypto.randomUUID(),
			userId,
			email,
			tokenHash,
			otpHash: otpHash ?? null,
			expiresAt,
			createdAt: new Date(),
		};
	}

	async findByTokenHash(tokenHash: string): Promise<MagicLinkToken | null> {
		const [row] = await this.db
			.select()
			.from(this.tokensTable)
			.where(eq(requireColumn(this.tokensTable, this.columns.tokenHash), tokenHash));
		return mapTokenRow(row ?? null, this.columns);
	}

	async findByEmailAndOtpHash({
		email,
		otpHash,
	}: {
		email: string;
		otpHash: string;
	}): Promise<MagicLinkToken | null> {
		const [row] = await this.db
			.select()
			.from(this.tokensTable)
			.where(
				requireCondition(and(
					eq(requireColumn(this.tokensTable, this.columns.email), email),
					eq(requireColumn(this.tokensTable, this.columns.otpHash), otpHash),
				)),
			);
		return mapTokenRow(row ?? null, this.columns);
	}

	async deleteById(tokenId: string): Promise<void> {
		await this.db
			.delete(this.tokensTable)
			.where(eq(requireColumn(this.tokensTable, this.columns.id), tokenId));
	}

	async deleteByUserId(userId: string): Promise<void> {
		await this.db
			.delete(this.tokensTable)
			.where(eq(requireColumn(this.tokensTable, this.columns.userId), userId));
	}

	async deleteByEmail(email: string): Promise<void> {
		await this.db
			.delete(this.tokensTable)
			.where(eq(requireColumn(this.tokensTable, this.columns.email), email));
	}
}
