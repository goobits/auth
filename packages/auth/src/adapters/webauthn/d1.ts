import { WebAuthnAdapter } from "./base.js";
import type { WebAuthnCredential } from "../../types/index.js";

type D1Value = string | number | boolean | null;
type D1Row = Record<string, D1Value>;

type D1DatabaseLike = {
	prepare: (sql: string) => {
		bind: (...args: D1Value[]) => {
			run: () => Promise<unknown>;
			first: () => Promise<D1Row | null>;
			all: () => Promise<{ results?: D1Row[] }>;
		};
	};
};

type WebAuthnChallengeRecord = {
	id: string;
	userId: string | null;
	challenge: string;
	type: string;
	expiresAt: Date;
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
			credentialId: options.columns?.["credentialId"] || "credential_id",
			userId: options.columns?.["userId"] || "user_id",
			publicKey: options.columns?.["publicKey"] || "public_key",
			counter: options.columns?.["counter"] || "counter",
			transports: options.columns?.["transports"] || "transports",
			name: options.columns?.["name"] || "name",
			createdAt: options.columns?.["createdAt"] || "created_at",
			updatedAt: options.columns?.["updatedAt"] || "updated_at",
			challengeId: options.columns?.["challengeId"] || "id",
			challenge: options.columns?.["challenge"] || "challenge",
			challengeType: options.columns?.["challengeType"] || "type",
			challengeUserId: options.columns?.["challengeUserId"] || "user_id",
			challengeExpiresAt: options.columns?.["challengeExpiresAt"] || "expires_at",
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

	private mapChallenge(row: D1Row | null): WebAuthnChallengeRecord | null {
		if (!row) return null;
		const id = row[this.columns.challengeId];
		const userId = row[this.columns.challengeUserId];
		const challenge = row[this.columns.challenge];
		const type = row[this.columns.challengeType];
		const expiresAt = row[this.columns.challengeExpiresAt];
		if (typeof id !== "string") return null;
		if (userId !== null && typeof userId !== "string" && typeof userId !== "number") {
			return null;
		}
		if (typeof challenge !== "string") return null;
		if (typeof type !== "string") return null;
		if (typeof expiresAt !== "string") return null;
		const expiresAtDate = new Date(expiresAt);
		if (Number.isNaN(expiresAtDate.getTime())) return null;
		return {
			id,
			userId: userId === null ? null : String(userId),
			challenge,
			type,
			expiresAt: expiresAtDate,
		};
	}

	private mapCredential(row: D1Row): WebAuthnCredential | null {
		const credentialId = row[this.columns.credentialId];
		const userId = row[this.columns.userId];
		const publicKey = row[this.columns.publicKey];
		const counter = row[this.columns.counter];
		const transportsRaw = row[this.columns.transports];
		const name = row[this.columns.name] ?? null;
		const createdAtRaw = row[this.columns.createdAt];
		const updatedAtRaw = row[this.columns.updatedAt];
		if (typeof credentialId !== "string") return null;
		if (typeof userId !== "string" && typeof userId !== "number") return null;
		if (typeof publicKey !== "string") return null;
		if (typeof counter !== "number") return null;
		if (transportsRaw !== null && typeof transportsRaw !== "string") return null;
		if (name !== null && typeof name !== "string") return null;
		let transports: string[] | null = null;
		if (typeof transportsRaw === "string") {
			try {
				const parsed = JSON.parse(transportsRaw);
				if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "string")) {
					return null;
				}
				transports = parsed;
			} catch {
				return null;
			}
		}
		const createdAt =
			typeof createdAtRaw === "string" && !Number.isNaN(new Date(createdAtRaw).getTime())
				? new Date(createdAtRaw)
				: new Date();
		const updatedAt =
			typeof updatedAtRaw === "string" && !Number.isNaN(new Date(updatedAtRaw).getTime())
				? new Date(updatedAtRaw)
				: new Date();
		return {
			id: credentialId,
			userId: String(userId),
			credentialId,
			publicKey,
			counter,
			transports,
			name,
			createdAt,
			updatedAt,
		};
	}

	async getChallenge(challengeId: string): Promise<WebAuthnChallengeRecord | null> {
		const sql = `SELECT * FROM ${this.challengesTable} WHERE ${this.columns.challengeId} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(challengeId).first();
		return this.mapChallenge(row);
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

	async getCredential(credentialId: string): Promise<WebAuthnCredential | null> {
		const sql = `SELECT * FROM ${this.credentialsTable} WHERE ${this.columns.credentialId} = ? LIMIT 1`;
		const row = await this.db.prepare(sql).bind(credentialId).first();
		if (!row) return null;
		return this.mapCredential(row);
	}

	async listCredentials(userId: string): Promise<WebAuthnCredential[]> {
		const sql = `SELECT * FROM ${this.credentialsTable} WHERE ${this.columns.userId} = ?`;
		const result = await this.db.prepare(sql).bind(userId).all();
		const rows = result?.results ?? [];
		const credentials: WebAuthnCredential[] = [];
		for (const row of rows) {
			const credential = this.mapCredential(row);
			if (credential) credentials.push(credential);
		}
		return credentials;
	}

	async updateCredential(credentialId: string, updates: Record<string, unknown>) {
		const payload = new Map<string, D1Value>();
		for (const [key, value] of Object.entries(updates)) {
			const column = this.columns[key as keyof typeof this.columns] || key;
			if (column === this.columns.transports && Array.isArray(value)) {
				if (value.every((entry) => typeof entry === "string")) {
					payload.set(column, JSON.stringify(value));
				}
				continue;
			}
			if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
				payload.set(column, value);
			}
		}
		const fields = Array.from(payload.keys());
		if (fields.length === 0) return;
		const setSql = fields.map((field) => `${field} = ?`).join(", ");
		const sql = `UPDATE ${this.credentialsTable} SET ${setSql} WHERE ${this.columns.credentialId} = ?`;
		const values = fields.map((field) => payload.get(field) ?? null);
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
