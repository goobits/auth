import { WebAuthnAdapter } from "./base.js";

export class D1WebAuthnAdapter extends WebAuthnAdapter {
	constructor(db, options = {}) {
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

	async createChallenge({ challengeId, userId, challenge, type, expiresAt }) {
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

	async getChallenge(challengeId) {
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

	async deleteChallenge(challengeId) {
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

	async getCredential(credentialId) {
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

	async listCredentials(userId) {
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

	async updateCredential(credentialId, updates) {
		const payload = {};
		for (const [key, value] of Object.entries(updates)) {
			const column = this.columns[key] || key;
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

	async deleteCredential(credentialId) {
		await this.db
			.prepare(
				`DELETE FROM ${this.credentialsTable} WHERE ${this.columns.credentialId} = ?`,
			)
			.bind(credentialId)
			.run();
	}

	async deleteUserCredentials(userId) {
		await this.db
			.prepare(
				`DELETE FROM ${this.credentialsTable} WHERE ${this.columns.userId} = ?`,
			)
			.bind(userId)
			.run();
	}
}
