import { eq } from "drizzle-orm";
import { WebAuthnAdapter } from "./base.js";
import type { WebAuthnCredential } from "../../types/index.js";
import {
	requireColumn,
	type DrizzleDbLike,
	type DrizzleJson,
	type DrizzleRow,
	type DrizzleTable,
} from "../drizzle-types.js";

type CredentialsTable = DrizzleTable;
type ChallengesTable = DrizzleTable;

type ChallengeRecord = {
	id: string;
	userId: string | null;
	challenge: string;
	type: string;
	expiresAt: Date;
};

function mapChallengeRow(
	row: DrizzleRow | null,
	columns: {
		challengeId: string;
		challengeUserId: string;
		challenge: string;
		challengeType: string;
		challengeExpiresAt: string;
	},
): ChallengeRecord | null {
	if (!row) return null;
	const id = row[columns.challengeId];
	const userId = row[columns.challengeUserId] ?? null;
	const challenge = row[columns.challenge];
	const type = row[columns.challengeType];
	const expiresAt = row[columns.challengeExpiresAt];
	if (typeof id !== "string") return null;
	if (userId !== null && typeof userId !== "string" && typeof userId !== "number") return null;
	if (typeof challenge !== "string") return null;
	if (typeof type !== "string") return null;
	if (!(expiresAt instanceof Date) && typeof expiresAt !== "string") return null;
	const expiresAtDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
	if (Number.isNaN(expiresAtDate.getTime())) return null;
	return {
		id,
		userId: userId === null ? null : String(userId),
		challenge,
		type,
		expiresAt: expiresAtDate,
	};
}

function mapCredentialRow(
	row: DrizzleRow | null,
	columns: {
		credentialId: string;
		userId: string;
		publicKey: string;
		counter: string;
		transports: string;
		name: string;
		createdAt: string;
		updatedAt: string;
	},
): WebAuthnCredential | null {
	if (!row) return null;
	const credentialId = row[columns.credentialId];
	const userId = row[columns.userId];
	const publicKey = row[columns.publicKey];
	const counter = row[columns.counter];
	const transportsRaw = row[columns.transports] ?? null;
	const name = row[columns.name] ?? null;
	const createdAt = row[columns.createdAt];
	const updatedAt = row[columns.updatedAt];
	if (typeof credentialId !== "string") return null;
	if (typeof userId !== "string" && typeof userId !== "number") return null;
	if (typeof publicKey !== "string") return null;
	if (typeof counter !== "number") return null;
	if (transportsRaw !== null && typeof transportsRaw !== "string") return null;
	if (name !== null && typeof name !== "string") return null;
	let transports: string[] | null = null;
	if (typeof transportsRaw === "string") {
		const parsed = JSON.parse(transportsRaw);
		if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
			return null;
		}
		transports = parsed;
	}
	const createdAtDate =
		createdAt instanceof Date
			? createdAt
			: typeof createdAt === "string"
				? new Date(createdAt)
				: new Date();
	const updatedAtDate =
		updatedAt instanceof Date
			? updatedAt
			: typeof updatedAt === "string"
				? new Date(updatedAt)
				: new Date();
	return {
		id: credentialId,
		userId: String(userId),
		credentialId,
		publicKey,
		counter,
		transports,
		name,
		createdAt: Number.isNaN(createdAtDate.getTime()) ? new Date() : createdAtDate,
		updatedAt: Number.isNaN(updatedAtDate.getTime()) ? new Date() : updatedAtDate,
	};
}

export class DrizzleWebAuthnAdapter extends WebAuthnAdapter {
	private db: DrizzleDbLike;
	private credentialsTable: CredentialsTable;
	private challengesTable: ChallengesTable;
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
		db: DrizzleDbLike,
		options: {
			credentialsTable?: CredentialsTable;
			challengesTable?: ChallengesTable;
			columns?: Partial<Record<string, string>>;
		} = {},
	) {
		super();
		if (!options.credentialsTable || !options.challengesTable) {
			throw new Error(
				"DrizzleWebAuthnAdapter requires credentialsTable and challengesTable options",
			);
		}
		this.db = db;
		this.credentialsTable = options.credentialsTable;
		this.challengesTable = options.challengesTable;
		this.columns = {
			credentialId: options.columns?.["credentialId"] || "credentialId",
			userId: options.columns?.["userId"] || "userId",
			publicKey: options.columns?.["publicKey"] || "publicKey",
			counter: options.columns?.["counter"] || "counter",
			transports: options.columns?.["transports"] || "transports",
			name: options.columns?.["name"] || "name",
			createdAt: options.columns?.["createdAt"] || "createdAt",
			updatedAt: options.columns?.["updatedAt"] || "updatedAt",
			challengeId: options.columns?.["challengeId"] || "id",
			challenge: options.columns?.["challenge"] || "challenge",
			challengeType: options.columns?.["challengeType"] || "type",
			challengeUserId: options.columns?.["challengeUserId"] || "userId",
			challengeExpiresAt: options.columns?.["challengeExpiresAt"] || "expiresAt",
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
	}): Promise<void> {
		await this.db.insert(this.challengesTable).values({
			[this.columns.challengeId]: challengeId,
			[this.columns.challengeUserId]: userId,
			[this.columns.challenge]: challenge,
			[this.columns.challengeType]: type,
			[this.columns.challengeExpiresAt]: expiresAt,
		});
	}

	async getChallenge(challengeId: string): Promise<ChallengeRecord | null> {
		const [row] = await this.db
			.select()
			.from(this.challengesTable)
			.where(eq(requireColumn(this.challengesTable, this.columns.challengeId), challengeId));
		return mapChallengeRow(row ?? null, this.columns);
	}

	async deleteChallenge(challengeId: string): Promise<void> {
		await this.db
			.delete(this.challengesTable)
			.where(eq(requireColumn(this.challengesTable, this.columns.challengeId), challengeId));
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
	}): Promise<void> {
		await this.db.insert(this.credentialsTable).values({
			[this.columns.userId]: userId,
			[this.columns.credentialId]: credentialId,
			[this.columns.publicKey]: publicKey,
			[this.columns.counter]: counter,
			[this.columns.transports]: transports ? JSON.stringify(transports) : null,
			[this.columns.name]: name ?? null,
		});
	}

	async getCredential(credentialId: string): Promise<WebAuthnCredential | null> {
		const [row] = await this.db
			.select()
			.from(this.credentialsTable)
			.where(eq(requireColumn(this.credentialsTable, this.columns.credentialId), credentialId));
		return mapCredentialRow(row ?? null, this.columns);
	}

	async listCredentials(userId: string): Promise<WebAuthnCredential[]> {
		const rows = await this.db
			.select()
			.from(this.credentialsTable)
			.where(eq(requireColumn(this.credentialsTable, this.columns.userId), userId));
		const credentials: WebAuthnCredential[] = [];
		for (const row of rows) {
			const credential = mapCredentialRow(row, this.columns);
			if (credential) credentials.push(credential);
		}
		return credentials;
	}

	async updateCredential(
		credentialId: string,
		updates: Record<string, DrizzleJson>,
	): Promise<void> {
		const payload: DrizzleRow = {};
		const columnLookup: Record<string, string> = this.columns;
		for (const [key, value] of Object.entries(updates)) {
			const mappedColumn = columnLookup[key] || key;
			if (mappedColumn === this.columns.transports && Array.isArray(value)) {
				if (value.every((entry) => typeof entry === "string")) {
					payload[mappedColumn] = JSON.stringify(value);
				}
				continue;
			}
			payload[mappedColumn] = value;
		}
		if (Object.keys(payload).length === 0) return;
		await this.db
			.update(this.credentialsTable)
			.set(payload)
			.where(eq(requireColumn(this.credentialsTable, this.columns.credentialId), credentialId));
	}

	async deleteCredential(credentialId: string): Promise<void> {
		await this.db
			.delete(this.credentialsTable)
			.where(eq(requireColumn(this.credentialsTable, this.columns.credentialId), credentialId));
	}

	async deleteUserCredentials(userId: string): Promise<void> {
		await this.db
			.delete(this.credentialsTable)
			.where(eq(requireColumn(this.credentialsTable, this.columns.userId), userId));
	}
}
