import { VerificationTokenAdapter } from "../../utils/tokens.ts";
import { and, eq } from "drizzle-orm";

/**
 * Drizzle ORM implementation of VerificationTokenAdapter
 * Stores verification tokens in a database table
 */
export class DrizzleVerificationTokenAdapter extends VerificationTokenAdapter {
	private db: any;
	private tokensTable: any;
	private usersTable: any;
	/**
	 * @param {import('drizzle-orm').DrizzleD1Database} db - Drizzle database instance
	 * @param {Object} options - Configuration
	 * @param {import('drizzle-orm').Table} options.tokensTable - Verification tokens table
	 * @param {import('drizzle-orm').Table} options.usersTable - Users table
	 */
	constructor(
		db: any,
		options: { tokensTable?: any; usersTable?: any } = {},
	) {
		super();

		if (!db) {
			throw new Error("DrizzleVerificationTokenAdapter requires a database instance");
		}

		if (!options.tokensTable) {
			throw new Error("DrizzleVerificationTokenAdapter requires tokensTable option");
		}

		if (!options.usersTable) {
			throw new Error("DrizzleVerificationTokenAdapter requires usersTable option");
		}

		this.db = db;
		this.tokensTable = options.tokensTable;
		this.usersTable = options.usersTable;
	}

	async create({
		userId,
		type,
		token,
		expiresAt,
	}: {
		userId: string;
		type: string;
		token: string;
		expiresAt: Date;
	}) {
		await this.db.insert(this.tokensTable).values({
			userId,
			type,
			token,
			expiresAt,
		});
	}

	async findByToken({ token, type }: { token: string; type: string }) {
		const [record] = await this.db
			.select({
				token: this.tokensTable,
				user: this.usersTable,
			})
			.from(this.tokensTable)
			.innerJoin(
				this.usersTable,
				eq(this.tokensTable.userId, this.usersTable.id),
			)
			.where(
				and(
					eq(this.tokensTable.token, token),
					eq(this.tokensTable.type, type),
				),
			)
			.limit(1);

		return record || null;
	}

	async deleteById(tokenId: string) {
		await this.db
			.delete(this.tokensTable)
			.where(eq(this.tokensTable.id, tokenId));
	}

	async deleteByUserAndType({ userId, type }: { userId: string; type: string }) {
		await this.db
			.delete(this.tokensTable)
			.where(
				and(
					eq(this.tokensTable.userId, userId),
					eq(this.tokensTable.type, type),
				),
			);
	}
}
