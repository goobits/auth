import { WebAuthnAdapter } from "./base.ts";
import { eq } from "drizzle-orm";

export class DrizzleWebAuthnAdapter extends WebAuthnAdapter {
	private db: unknown;
	private credentialsTable: Record<string, unknown>;
	private challengesTable: Record<string, unknown>;
	private columns: {
		credentialId: string;
		userId: string;
		publicKey: string;
		counter: string;
		transports: string;
		name: string;
		createdAt: string;
		updatedAt: string;
		challengeId: string;
		challenge: string;
		challengeType: string;
		challengeUserId: string;
		challengeExpiresAt: string;
	};
	/**
	 * @param {Object} db - Drizzle instance
	 * @param {Object} options
	 * @param {Object} options.credentialsTable
	 * @param {Object} options.challengesTable
	 * @param {Object} [options.columns]
	 */
	constructor(
		db: unknown,
		options: {
			credentialsTable?: Record<string, unknown>;
			challengesTable?: Record<string, unknown>;
			columns?: Partial<Record<string, string>>;
		} = {},
	) {
		super();
		this.db = db;
		this.credentialsTable = options.credentialsTable ?? {};
		this.challengesTable = options.challengesTable ?? {};
		this.columns = {
			credentialId: options.columns?.credentialId || "credentialId",
			userId: options.columns?.userId || "userId",
			publicKey: options.columns?.publicKey || "publicKey",
			counter: options.columns?.counter || "counter",
			transports: options.columns?.transports || "transports",
			name: options.columns?.name || "name",
			createdAt: options.columns?.createdAt || "createdAt",
			updatedAt: options.columns?.updatedAt || "updatedAt",
			challengeId: options.columns?.challengeId || "id",
			challenge: options.columns?.challenge || "challenge",
			challengeType: options.columns?.challengeType || "type",
			challengeUserId: options.columns?.challengeUserId || "userId",
			challengeExpiresAt: options.columns?.challengeExpiresAt || "expiresAt",
		};

		if (!options.credentialsTable || !options.challengesTable) {
			throw new Error(
				"DrizzleWebAuthnAdapter requires credentialsTable and challengesTable options",
			);
		}
	}

	async createChallenge({
		challengeId,
		userId,
		challenge,
		type,
		expiresAt,
	}: {
		challengeId: string;
		userId: string | null;
		challenge: string;
		type: string;
		expiresAt: Date;
	}) {
		const columns: Record<string, string> = this.columns;
		await this.db.insert(this.challengesTable).values({
			[columns.challengeId]: challengeId,
			[columns.challengeUserId]: userId,
			[columns.challenge]: challenge,
			[columns.challengeType]: type,
			[columns.challengeExpiresAt]: expiresAt,
		});
	}

	async getChallenge(challengeId: string) {
		const [record] = await this.db
			.select()
			.from(this.challengesTable)
			.where(eq(this.challengesTable[this.columns.challengeId], challengeId));
		if (!record) return null;
		return {
			id: record[this.columns.challengeId],
			userId: record[this.columns.challengeUserId],
			challenge: record[this.columns.challenge],
			type: record[this.columns.challengeType],
			expiresAt: record[this.columns.challengeExpiresAt],
		};
	}

	async deleteChallenge(challengeId: string) {
		await this.db
			.delete(this.challengesTable)
			.where(eq(this.challengesTable[this.columns.challengeId], challengeId));
	}

	async createCredential({
		userId,
		credentialId,
		publicKey,
		counter,
		transports,
		name,
	}: {
		userId: string;
		credentialId: string;
		publicKey: string;
		counter: number;
		transports?: string[] | null;
		name?: string | null;
	}) {
		const columns: Record<string, string> = this.columns;
		await this.db.insert(this.credentialsTable).values({
			[columns.userId]: userId,
			[columns.credentialId]: credentialId,
			[columns.publicKey]: publicKey,
			[columns.counter]: counter,
			[columns.transports]: transports ? JSON.stringify(transports) : null,
			[columns.name]: name ?? null,
		});
	}

	async getCredential(credentialId: string) {
		const [record] = await this.db
			.select()
			.from(this.credentialsTable)
			.where(eq(this.credentialsTable[this.columns.credentialId], credentialId));
		if (!record) return null;
		return {
			credentialId: record[this.columns.credentialId],
			userId: record[this.columns.userId],
			publicKey: record[this.columns.publicKey],
			counter: record[this.columns.counter],
			transports: record[this.columns.transports]
				? JSON.parse(record[this.columns.transports])
				: null,
			name: record[this.columns.name] ?? null,
			createdAt: record[this.columns.createdAt] ?? null,
			updatedAt: record[this.columns.updatedAt] ?? null,
		};
	}

	async listCredentials(userId: string) {
		const records = await this.db
			.select()
			.from(this.credentialsTable)
			.where(eq(this.credentialsTable[this.columns.userId], userId));
		return records.map((record: Record<string, unknown>) => ({
			credentialId: record[this.columns.credentialId],
			userId: record[this.columns.userId],
			publicKey: record[this.columns.publicKey],
			counter: record[this.columns.counter],
			transports: record[this.columns.transports]
				? JSON.parse(record[this.columns.transports])
				: null,
			name: record[this.columns.name] ?? null,
			createdAt: record[this.columns.createdAt] ?? null,
			updatedAt: record[this.columns.updatedAt] ?? null,
		}));
	}

	async updateCredential(
		credentialId: string,
		updates: Record<string, unknown>,
	) {
		const payload: Record<string, unknown> = {};
		const columns = this.columns as Record<string, string>;
		for (const [key, value] of Object.entries(updates)) {
			const column = columns[key] || key;
			payload[column] = value;
		}
		if (payload[this.columns.transports]) {
			payload[this.columns.transports] = JSON.stringify(
				payload[this.columns.transports],
			);
		}
		await this.db
			.update(this.credentialsTable)
			.set(payload)
			.where(eq(this.credentialsTable[this.columns.credentialId], credentialId));
	}

	async deleteCredential(credentialId: string) {
		await this.db
			.delete(this.credentialsTable)
			.where(eq(this.credentialsTable[this.columns.credentialId], credentialId));
	}

	async deleteUserCredentials(userId: string) {
		await this.db
			.delete(this.credentialsTable)
			.where(eq(this.credentialsTable[this.columns.userId], userId));
	}
}
