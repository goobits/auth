import { WebAuthnAdapter } from "./base.js";
import { eq } from "drizzle-orm";

export class DrizzleWebAuthnAdapter extends WebAuthnAdapter {
	/**
	 * @param {Object} db - Drizzle instance
	 * @param {Object} options
	 * @param {Object} options.credentialsTable
	 * @param {Object} options.challengesTable
	 * @param {Object} [options.columns]
	 */
	constructor(db, options = {}) {
		super();
		this.db = db;
		this.credentialsTable = options.credentialsTable;
		this.challengesTable = options.challengesTable;
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

		if (!this.credentialsTable || !this.challengesTable) {
			throw new Error(
				"DrizzleWebAuthnAdapter requires credentialsTable and challengesTable options",
			);
		}
	}

	async createChallenge({ challengeId, userId, challenge, type, expiresAt }) {
		await this.db.insert(this.challengesTable).values({
			[this.columns.challengeId]: challengeId,
			[this.columns.challengeUserId]: userId,
			[this.columns.challenge]: challenge,
			[this.columns.challengeType]: type,
			[this.columns.challengeExpiresAt]: expiresAt,
		});
	}

	async getChallenge(challengeId) {
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

	async deleteChallenge(challengeId) {
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
	}) {
		await this.db.insert(this.credentialsTable).values({
			[this.columns.userId]: userId,
			[this.columns.credentialId]: credentialId,
			[this.columns.publicKey]: publicKey,
			[this.columns.counter]: counter,
			[this.columns.transports]: transports ? JSON.stringify(transports) : null,
			[this.columns.name]: name ?? null,
		});
	}

	async getCredential(credentialId) {
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

	async listCredentials(userId) {
		const records = await this.db
			.select()
			.from(this.credentialsTable)
			.where(eq(this.credentialsTable[this.columns.userId], userId));
		return records.map((record) => ({
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
		await this.db
			.update(this.credentialsTable)
			.set(payload)
			.where(eq(this.credentialsTable[this.columns.credentialId], credentialId));
	}

	async deleteCredential(credentialId) {
		await this.db
			.delete(this.credentialsTable)
			.where(eq(this.credentialsTable[this.columns.credentialId], credentialId));
	}

	async deleteUserCredentials(userId) {
		await this.db
			.delete(this.credentialsTable)
			.where(eq(this.credentialsTable[this.columns.userId], userId));
	}
}
