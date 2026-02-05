import { WebAuthnAdapter } from "./base.ts";

type D1DatabaseLike = {
	prepare: (sql: string) => {
		bind: (...args: unknown[]) => {
			run: () => Promise<unknown>;
			first: () => Promise<Record<string, unknown> | null>;
			all: () => Promise<{ results?: Record<string, unknown>[] }>;
		};
	};
};

export class D1WebAuthnAdapter extends WebAuthnAdapter {
	private db: D1DatabaseLike;
	private credentialsTable: string;
	private challengesTable: string;
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

	constructor(
		db: D1DatabaseLike,
		options: {
			credentialsTable?: string;
			challengesTable?: string;
			columns?: Partial<Record<string, string>>;
		} = {},
	) {
		super();
		this.db = db;
		this.credentialsTable = options.credentialsTable || "webauthn_credentials";
		this.challengesTable = options.challengesTable || "webauthn_challenges";
		this.columns = {
			credentialId: options.columns?.credentialId || "credential_id",
			userId: options.columns?.userId || "user_id",
			publicKey: options.columns?.publicKey || "public_key",
			counter: options.columns?.counter || "counter",
			transports: options.columns?.transports || "transports",
			name: options.columns?.name || "name",
			createdAt: options.columns?.createdAt || "created_at",
			updatedAt: options.columns?.updatedAt || "updated_at",
			challengeId: options.columns?.challengeId || "id",
			challenge: options.columns?.challenge || "challenge",
			challengeType: options.columns?.challengeType || "type",
			challengeUserId: options.columns?.challengeUserId || "user_id",
			challengeExpiresAt: options.columns?.challengeExpiresAt || "expires_at",
		};
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
		const sql = `INSERT INTO ${this.challengesTable} (${this.columns.challengeId}, ${this.columns.challengeUserId}, ${this.columns.challenge}, ${this.columns.challengeType}, ${this.columns.challengeExpiresAt}) VALUES (?, ?, ?, ?, ?)`;
		await this.db
			.prepare(sql)
			.bind(
				challengeId,
				userId,
				challenge,
				type,
				expiresAt.toISOString(),
			)
			.run();
	}

	async getChallenge(challengeId: string) {
		const sql = `SELECT * FROM ${this.challengesTable} WHERE ${this.columns.challengeId} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(challengeId).first();
		if (!row) return null;
		return {
			id: row[this.columns.challengeId],
			userId: row[this.columns.challengeUserId],
			challenge: row[this.columns.challenge],
			type: row[this.columns.challengeType],
			expiresAt: row[this.columns.challengeExpiresAt],
		};
	}

	async deleteChallenge(challengeId: string) {
		await this.db
			.prepare(
				`DELETE FROM ${this.challengesTable} WHERE ${this.columns.challengeId} = ?`,
			)
			.bind(challengeId)
			.run();
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
		const sql = `INSERT INTO ${this.credentialsTable} (${this.columns.userId}, ${this.columns.credentialId}, ${this.columns.publicKey}, ${this.columns.counter}, ${this.columns.transports}, ${this.columns.name}) VALUES (?, ?, ?, ?, ?, ?)`;
		await this.db
			.prepare(sql)
			.bind(
				userId,
				credentialId,
				publicKey,
				counter,
				transports ? JSON.stringify(transports) : null,
				name ?? null,
			)
			.run();
	}

	async getCredential(credentialId: string) {
		const sql = `SELECT * FROM ${this.credentialsTable} WHERE ${this.columns.credentialId} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(credentialId).first();
		if (!row) return null;
		return {
			credentialId: row[this.columns.credentialId],
			userId: row[this.columns.userId],
			publicKey: row[this.columns.publicKey],
			counter: row[this.columns.counter],
			transports: row[this.columns.transports]
				? JSON.parse(row[this.columns.transports])
				: null,
			name: row[this.columns.name] ?? null,
			createdAt: row[this.columns.createdAt] ?? null,
			updatedAt: row[this.columns.updatedAt] ?? null,
		};
	}

	async listCredentials(userId: string) {
		const sql = `SELECT * FROM ${this.credentialsTable} WHERE ${this.columns.userId} = ?`;
		const result = await this.db.prepare(sql).bind(userId).all();
		const rows = result?.results ?? [];
		return rows.map((row) => ({
			credentialId: row[this.columns.credentialId],
			userId: row[this.columns.userId],
			publicKey: row[this.columns.publicKey],
			counter: row[this.columns.counter],
			transports: row[this.columns.transports]
				? JSON.parse(row[this.columns.transports])
				: null,
			name: row[this.columns.name] ?? null,
			createdAt: row[this.columns.createdAt] ?? null,
			updatedAt: row[this.columns.updatedAt] ?? null,
		}));
	}

	async updateCredential(credentialId: string, updates: Record<string, unknown>) {
		const payload: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(updates)) {
			const column = (this.columns as Record<string, string>)[key] || key;
			payload[column] = value;
		}
		if (payload[this.columns.transports]) {
			payload[this.columns.transports] = JSON.stringify(
				payload[this.columns.transports],
			);
		}
		const fields = Object.keys(payload);
		if (fields.length === 0) return;
		const setSql = fields.map((field) => `${field} = ?`).join(", ");
		const sql = `UPDATE ${this.credentialsTable} SET ${setSql} WHERE ${this.columns.credentialId} = ?`;
		const values = fields.map((field) => payload[field]);
		await this.db.prepare(sql).bind(...values, credentialId).run();
	}

	async deleteCredential(credentialId: string) {
		await this.db
			.prepare(
				`DELETE FROM ${this.credentialsTable} WHERE ${this.columns.credentialId} = ?`,
			)
			.bind(credentialId)
			.run();
	}

	async deleteUserCredentials(userId: string) {
		await this.db
			.prepare(
				`DELETE FROM ${this.credentialsTable} WHERE ${this.columns.userId} = ?`,
			)
			.bind(userId)
			.run();
	}
}
